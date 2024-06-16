const fragmentShader = `

uniform float uTime;
uniform vec2 uMouse;
uniform samplerCube iChannel0;
uniform float progress;
uniform sampler2D uTexture;
uniform sampler2D uNoiseTexture;
uniform vec4 uResolution;
uniform float uReflection;
uniform float uSpeed;
uniform float uIOR;
uniform int uCount;
uniform float uSize;
uniform float uDispersion;
uniform float uRefractPower;
uniform float uChromaticAberration;

uniform vec3 uCamPos;
uniform mat4 uCamToWorldMat;
uniform mat4 uCamInverseProjMat;

uniform mat4 uInverseModelMatrix;

varying vec2 vUv;
varying vec3 worldNormal;
varying vec4 vPosition;

const float PI = 3.14159265359;
const float HALF_PI = 0.5*PI;
const float TWO_PI = 2.0*PI;
const int LOOP = 16;

#define MAX_STEPS 200

float hash(in float v) { return fract(sin(v)*43237.5324); }
vec3 hash3(in float v) { return vec3(hash(v), hash(v*99.), hash(v*9999.)); }

float sphere(in vec3 p, in float r) { 
    float d = length(p) - r; 
    // sin displacement
    // d += sin(p.x * 8. + uTime) * 0.1;

    // texture displacement
    // vec2 uv = vec2(atan(p.x, p.z) / TWO_PI, p.y / 5.);
    vec2 uv = vec2(0.5 + atan(p.z, p.x) / (2.0 * PI), 0.5 - asin(p.y) / PI);
    float noise = texture2D(uNoiseTexture, uv).r;
    float displacement = sin(p.x * 3.0 + uTime * 1. + noise) * 0.001
    ;
    displacement *= smoothstep(0.8, -0.8, p.y); // reduce displacement at the poles
    d += displacement;

    return d;
    }

float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

#define BALL_NUM 5

float map(in vec3 p) {
  float res = 1e5;
  for(int i=0; i<BALL_NUM; i++) {
    float fi = float(i) + 0.01;
    float r = uSize * 0.00008 * hash(fi);
    vec3 offset = 0.1 * sin(hash3(fi) * uTime);
    res = opSmoothUnion(res, sphere(p - offset, r), 0.75);
  }
  return res;
}

vec3 normal(in vec3 p) {
	vec2 e = vec2(1., -1.)*1e-3;
    return normalize(
    	e.xyy * map(p+e.xyy)+
    	e.yxy * map(p+e.yxy)+
    	e.yyx * map(p+e.yyx)+
    	e.xxx * map(p+e.xxx)
    );
}

mat3 lookAt(in vec3 eye, in vec3 tar, in float r) {
	vec3 cz = normalize(tar - eye);
    vec3 cx = normalize(cross(cz, vec3(sin(r), cos(r), 0.)));
    vec3 cy = normalize(cross(cx, cz));
    return mat3(cx, cy, cz);
}

void main()
{
    float iorRatio = uIOR;
    
    vec2 uv = vUv;
    vec4 p = vPosition; 
    
    
    // vec2 p = vec2(uv * 2. - 1.);  

    // // Thanks @alwayscodingsomething for the matrix help
    mat4 im = uInverseModelMatrix;
    vec4 cam = vec4(uCamPos, 1.0);
    vec4 oro = im * cam;
    vec3 ro = oro.xyz;
    vec3 rd = normalize(p.xyz - ro);

    // UVs
      

    // vec3 ro = uCamPos;
    // vec3 rd = (uCamInverseProjMat * vec4(uv * 2.0 - 1.0, 0.0, 1.0)).xyz;
    // rd = (uCamToWorldMat * vec4(rd, 0.0)).xyz;
    // rd = normalize(rd);

    vec2 tmm = vec2(0., 10.);
    float t = 0.;
    for(int i = 0; i < MAX_STEPS; i++) {

        float tmp = map(ro + rd * t);
        
        if(tmp < 0.01 || tmm.y < t) break;
        t += tmp * 0.07;
    }
  
    if(tmm.y < t) {
        
        // background
        gl_FragColor = vec4(1.0, 1.0, 1.0, 0.0);

    } else {
        
        // object position
        vec3 pos = ro + rd * t;
        // normal
        vec3 nor = normal(pos);
        // reflection
        vec3 ref = reflect(rd, nor);
        vec3 refOutside = texture2D(iChannel0, ref).rgb;

        // refraction
        // vec3 refractVec = refract(rd, nor, iorRatio);


    vec3 color = vec3(0.);

    float iorRatioRed = iorRatio + uDispersion;
    float iorRatioGreen = iorRatio;
    float iorRatioBlue = iorRatio - uDispersion;

for ( int i = 0; i < LOOP; i ++ ) {
  float slide = float(i) / float(LOOP) * 0.1;

    vec3 refractVecR = refract(rd, nor, iorRatioRed);
    vec3 refractVecG = refract(rd, nor, iorRatioGreen);
    vec3 refractVecB = refract(rd, nor, iorRatioBlue);

    // color.r += texture2D(uTexture, uv + refractVecR.xy * (uRefractPower + slide * 1.0) * uChromaticAberration).r;
    // color.g += texture2D(uTexture, uv + refractVecG.xy * (uRefractPower + slide * 2.0) * uChromaticAberration).g;
    // color.b += texture2D(uTexture, uv + refractVecB.xy * (uRefractPower + slide * 3.0) * uChromaticAberration).b;

    color.r += texture2D(uTexture, uv + refractVecR.xy * (uRefractPower + slide * 1.0)).r;
    color.g += texture2D(uTexture, uv + refractVecG.xy * (uRefractPower + slide * 2.0)).g;
    color.b += texture2D(uTexture, uv + refractVecB.xy * (uRefractPower + slide * 3.0)).b;

    // color.r = 1. - color.r;
    // color.g = color.g - 0.2;
    // color.b = color.b - 0.1;

}

// Divide by the number of layers to normalize colors (rgb values can be worth up to the value of LOOP)
color /= float( LOOP );

//...


        // vec2 texCoord = ref.xy * 0.5 + 0.5;
        // color = texture2D(texture01, texCoord).rgb;
        // color = texture2D(uTexture, uv + refractVec.xy).rgb;

        // fresnel
        float fresnel = pow(1. + dot(rd, nor), uReflection);

        color = mix(color, refOutside, fresnel); 
        
        // color = vec3(fresnel);
        // color = vec3(refOutside);
    
        color = pow(color, vec3(.465));
        gl_FragColor = vec4(color, 1.);
        // gl_FragColor = vec4(uv, 0.0, 1.);
    }
    // gl_FragColor = vec4(uv, 0.0, 1.0);
}

`

export default fragmentShader
