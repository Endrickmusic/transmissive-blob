const fragmentShader = `

uniform float uTime;
uniform vec2 uMouse;
uniform samplerCube iChannel0;
uniform float progress;
uniform sampler2D texture01;
uniform vec4 uResolution;
uniform float dispersionOffset;
uniform float lensZoom;
uniform int count;

varying vec2 vUv;

#define MAX_STEPS 100
#define MAX_DIST 100.
#define SURF_DIST .001
#define TAU 6.283185
#define PI 3.141592
#define S smoothstep
#define T iTime
#define IOR 1.45

float smin( float a, float b, float k )
{
    k *= 4.0;
    float h = max( k-abs(a-b), 0.0 )/k;
    return min(a,b) - h*h*k*(1.0/4.0);
}

mat2 Rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
}

float sdBox(vec3 p, vec3 s) {
    p = abs(p) - s;
	return length(max(p, 0.)) + min(max(p.x, max(p.y, p.z)), 0.);
}

float sdSphere(vec3 p, float r) 
{
	return length(p) - r;   
}


float GetDist(vec3 p) {
    // float d = sdBox(p, vec3(1));
    // float d = sdSphere(p, 1.);

    float t = uTime * 0.2;
    float ec = 1.5;
    float r = 0.5;

    mat2 R = Rot(t);
    vec3 rotatedP1 = vec3(R * p.xz, p.y);
    vec3 rotatedP2 = vec3(p.x, R * p.yz);

    // spheres
    // float s1 = sdSphere(p - ec * vec3(cos(t*1.1),cos(t*1.3),cos(t*1.7)), r);
    // float s2 = sdSphere(p + ec * vec3(cos(t*0.7),cos(t*1.9),cos(t*2.3)), r);
    // float s3 = sdSphere(p + ec * vec3(cos(t*0.3),cos(t*2.9),sin(t*1.1)), r);
    

    // boxes
    float s1 = sdBox(rotatedP1 - ec * vec3(
        cos(t*1.1),
        cos(t*1.3),
        cos(t*1.7)),
         vec3(r));
    float s2 = sdBox(rotatedP2 + ec * vec3(cos(t*0.7),cos(t*1.9),cos(t*2.3)), vec3(r));
    float s3 = sdBox(p + ec * vec3(cos(t*0.3),cos(t*2.9),sin(t*1.1)), vec3(r));


    float k = .5;
    
    return smin (s1, smin(s2, s3, k), k);
}

float RayMarch(vec3 ro, vec3 rd, float side) {
	float dO=0.;
    
    for(int i=0; i<MAX_STEPS; i++) {
    	vec3 p = ro + rd*dO;
        float dS = GetDist(p) * side;
        dO += dS;
        if(dO>MAX_DIST || abs(dS)<SURF_DIST) break;
    }
    
    return dO;
}

vec3 GetNormal(vec3 p) {
    vec2 e = vec2(.015, 0);
    vec3 n = GetDist(p) - 
        vec3(GetDist(p-e.xyy), GetDist(p-e.yxy),GetDist(p-e.yyx));
    
    return normalize(n);
}

vec3 GetRayDir(vec2 uv, vec3 p, vec3 l, float z) {
    vec3 
        f = normalize(l-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f,r),
        c = f*z,
        i = c + uv.x*r + uv.y*u;
    return normalize(i);
}

void main()
{
    // vec2 uv = (gl_FragCoord.xy - .5 * uResolution.xy) / uResolution.y;
    vec2 uv = (vUv * 2. - 1.) * vec2(uResolution.x / uResolution.y, 1.);

	vec2 m = vec2(uMouse.x, -uMouse.y) / uResolution.xy * 0.002;

    vec3 ro = vec3(0, 3, -3);
    ro.yz *= Rot(-m.y*PI+1.);
    ro.xz *= Rot(-m.x*TAU);
    
    vec3 rd = GetRayDir(uv, ro, vec3(0,0.,0), 1.);
    vec3 col = texture2D(iChannel0, rd).xyz;
   
    float d = RayMarch(ro, rd, 1.);

    if(d<MAX_DIST) {
        vec3 p = ro + rd * d; // 3D hit position
        vec3 n = GetNormal(p); // normal at hit position
        vec3 r = reflect(rd, n); // reflection
        vec3 refOutside = texture2D(iChannel0, r).rgb; // reflection texture

        // float dif = dot(n, normalize(vec3(1,2,3)))*.5+.5;
        
        vec3 pEnter = p - n * SURF_DIST * 3.; // enter surface
        vec3 rdIn = refract(rd, n, 1./IOR); // ray direction when entering the object

        float dIn = RayMarch(pEnter, rdIn, -1.); // inside the object

        vec3 pExit = pEnter + rdIn * dIn; // 3D position of exit
        vec3 nExit = -GetNormal(pExit); // normal at hit position

        vec3 reflTex = vec3(0.);

        vec3 rdOut = vec3(0.);

        // chromatic aberration
        float abb = .02;

        // red
        rdOut = refract(rdIn, nExit, IOR - abb ); // ray direction when exiting the object
        if(dot(rdOut, rdOut)==0.) rdOut = reflect(rdIn, nExit); // total internal reflection
        reflTex.r = texture2D(iChannel0, rdOut).r;
        
        // green
        rdOut = refract(rdIn, nExit, IOR); // ray direction when exiting the object
        if(dot(rdOut, rdOut)==0.) rdOut = reflect(rdIn, nExit); // total internal reflection
        reflTex.g = texture2D(iChannel0, rdOut).g;

        // blue
        rdOut = refract(rdIn, nExit, IOR + abb); // ray direction when exiting the object
        if(dot(rdOut, rdOut)==0.) rdOut = reflect(rdIn, nExit); // total internal reflection
        reflTex.b = texture2D(iChannel0, rdOut).b;

        // fresnel
        float fresnel = pow(1. + dot(rd, n), 3.);
        // col = vec3(reflTex);
        // col = vec3(fresnel);

        col = mix(reflTex, refOutside, fresnel);
    }
    
    col = pow(col, vec3(.4545));	// gamma correction
    
    gl_FragColor = vec4(col,1.0);
}
`

export default fragmentShader
