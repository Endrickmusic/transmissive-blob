const fragmentShader = `

uniform float uTime;
uniform float progress;
uniform sampler2D texture01;
uniform vec4 uResolution;
uniform float dispersionOffset;
uniform float divideFactor;
uniform int count;
uniform float uSize;
uniform sampler2D uNoiseTexture;
uniform float uIOR;
uniform float uDispersion;
uniform float uRefractPower;
uniform float uChromaticAberration;
uniform sampler2D uTexture;
uniform samplerCube iChannel0;
uniform float uReflection;

varying vec2 vUv;
varying vec4 vPosition;
varying vec4 vRayOrigin;
varying vec3 vHitPos;

const float PI = 3.1415926;
const float HALF_PI = 0.5 * PI;
const float TWO_PI = 2.0 * PI;
const int LOOP = 16;

#define MAX_STEPS 100
#define MAX_DIST 40.
#define SURF_DIST 1e-3
#define samples 32
#define LOD 

float hash(in float v) { return fract(sin(v)*43237.5324); }
vec3 hash3(in float v) { return vec3(hash(v), hash(v*99.), hash(v*9999.)); }

float sdSphere(in vec3 p, in float r) { 
    float d = length(p) - r; 

    // texture displacement
    // vec2 uv = vec2(atan(p.x, p.z) / TWO_PI, p.y / 5.);
    // vec2 uv = vec2(0.5 + atan(p.z, p.x) / (2.0 * PI), 0.5 - asin(p.y) / PI);
    // float noise = texture2D(uNoiseTexture, uv).r;
    // float displacement = sin(p.x * 15.0 + uTime * 1. + noise) * 0.05;
    // displacement *= smoothstep(.9, -.1, p.y); // reduce displacement at the poles
    // d += displacement;

    return d;
    }

float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

#define BALL_NUM 5

float GetDist(vec3 p) {
	float d = 1e5;
	for(int i = 0; i < BALL_NUM; i++) {
		float fi = float(i) + 0.01;
		float r = uSize * 0.1;
		// float r = uSize * 0.1 * hash(fi);
		vec3 offset = .5 * sin(hash3(fi)) * cos(uTime + float(i));
		d = opSmoothUnion(d, sdSphere(p - offset, r), 0.3);
	}
  d = opSmoothUnion(d, sdBox(p - vec3(0., -.5, 0.), vec3(0.4, 0.01, 0.4)), 0.3);
	return d;
}

float SoftShadow( in vec3 ro, in vec3 rd, float mint, float maxt, float w )
{
    float res = 1.0;
    float t = mint;
    for( int i=0; i<256 && t<maxt; i++ )
    {
        float h = GetDist(ro + t*rd);
        res = min( res, h/(w*t) );
        t += clamp(h, 0.005, 0.50);
        if( res<-1.0 || t>maxt ) break;
    }
    res = max(res,-1.0);
    return 0.25*(1.0+res)*(1.0+res)*(2.0-res);
}

float Raymarch(vec3 ro, vec3 rd) {
	float dO = 0.;
	float dS;
	for (int i = 0; i < MAX_STEPS; i++) {
		vec3 p = ro + rd * dO;
		dS = GetDist(p);
		dO += dS;
		if (dS < SURF_DIST || dO > MAX_DIST) break;
	}
	return dO;
}

vec3 GetNormal(in vec3 p) {
	vec2 e = vec2(1., -1.) * 1e-3;
    return normalize(
    	e.xyy * GetDist(p+e.xyy)+
    	e.yxy * GetDist(p+e.yxy)+
    	e.yyx * GetDist(p+e.yyx)+
    	e.xxx * GetDist(p+e.xxx)
    );
}

	void main() {

		float iorRatio = uIOR;
		vec2 uv = vUv;
		vec3 ro = vRayOrigin.xyz;
		vec3 rd = normalize(vHitPos - ro); 

		float d = Raymarch(ro, rd);

		vec3 color = vec3(0.0);

		if ( d >= MAX_DIST )
			discard;
		else {
			vec3 p = ro + rd * d;
			vec3 n = GetNormal(p);

      // lighting 
      vec3 lightDir = normalize(vec3(0.0, 2.0, 0.0)); 
      float dif = clamp(dot(n, lightDir), 0.0, 1.0) * SoftShadow(p, lightDir, 0.01, 3.0, 0.1); 
      color += dif * 1.5;

			vec3 ref = reflect(rd, n);
      vec3 refOutside = texture2D(iChannel0, ref).rgb;

			float iorRatioRed = iorRatio + uDispersion;
    	float iorRatioGreen = iorRatio;
    	float iorRatioBlue = iorRatio - uDispersion;

			for ( int i = 0; i < LOOP; i ++ ) {

 				float slide = float(i) / float(LOOP) * 0.1;

				vec3 refractVecR = refract(rd, n, iorRatioRed);
				vec3 refractVecG = refract(rd, n, iorRatioGreen);
				vec3 refractVecB = refract(rd, n, iorRatioBlue);
		
				color.r += texture2D(uTexture, uv + refractVecR.xy * (uRefractPower + slide * 1.0)).r;
				color.g += texture2D(uTexture, uv + refractVecG.xy * (uRefractPower + slide * 2.0)).g;
				color.b += texture2D(uTexture, uv + refractVecB.xy * (uRefractPower + slide * 3.0)).b;
			}
		color /= float( LOOP );

		// fresnel
    float fresnel = pow(1. + dot(rd, n), uReflection);

    color = mix(color, refOutside, fresnel); 
        
		color = pow(color, vec3(.555));
		gl_FragColor = vec4(color, 1.0);
		}
	}
`
export default fragmentShader
