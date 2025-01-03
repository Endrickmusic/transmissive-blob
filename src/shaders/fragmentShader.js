const fragmentShader = `

uniform float uTime;
uniform float progress;
uniform sampler2D texture01;
uniform vec4 uResolution;
uniform float dispersionOffset;
uniform float divideFactor;
uniform int count;
uniform float uSize;
uniform vec3 uLightPos;

varying vec2 vUv;
varying vec4 vPosition;
varying vec4 vRayOrigin;
varying vec3 vHitPos;

const float PI = 3.1415926;
const float HALF_PI = 0.5 * PI;
const float TWO_PI = 2.0 * PI;
const int LOOP = 16;

#define MAX_STEPS 40
#define MAX_DIST 40.
#define SURF_DIST 1e-3
#define samples 32
#define LOD 

float hash(in float v) { return fract(sin(v)*43237.5324); }
vec3 hash3(in float v) { return vec3(hash(v), hash(v*99.), hash(v*9999.)); }

float sphere(in vec3 p, in float r) { 
    float d = length(p) - r; 

    // sin displacement
    // d += sin(p.x * 8. + uTime) * 0.1;

    // texture displacement
    // vec2 uv = vec2(atan(p.x, p.z) / TWO_PI, p.y / 5.);
    // vec2 uv = vec2(0.5 + atan(p.z, p.x) / (2.0 * PI), 0.5 - asin(p.y) / PI);
    // float noise = texture2D(uNoiseTexture, uv).r;
    // float displacement = sin(p.x * 3.0 + uTime * 1. + noise) * 0.001
    // ;
    // displacement *= smoothstep(0.8, -0.8, p.y); // reduce displacement at the poles
    // d += displacement;

    return d;
    }

float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

#define BALL_NUM 5

// float GetDist(vec3 p) {

// 	float d = length(p) - 1.; // sphere
// 	d = length(vec2(length(p.xz) - .4, p.y)) - .1;
// 	return d;
// }

float GetDist(vec3 p) {
	float d = 1e5;
	for(int i = 0; i < BALL_NUM; i++) {
		float fi = float(i) + 0.01;
		float r = uSize * 0.1;
		// float r = uSize * 0.1 * hash(fi);
		vec3 offset = .5 * sin(hash3(fi)) * cos(uTime + float(i));
		d = opSmoothUnion(d, sphere(p - offset, r), 0.24);
	}
	return d;
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

float SoftShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float ph = 1e20;
    float t = mint;
    for(int i = 0; i < 32; i++) {
        float h = GetDist(ro + rd * t);
        float y = h * h / (2.0 * ph);
        float d = sqrt(h * h - y * y);
        res = min(res, k * d / max(0.0, t - y));
        ph = h;
        t += h;
        if(t > maxt) break;
    }
    return clamp(res, 0.0, 1.0);
}

	void main() {

		vec2 uv = vUv - 0.5;
		vec3 ro = vRayOrigin.xyz; //vec3(0., 0., -3.);
		vec3 rd = normalize(vHitPos - ro); //normalize(vec3(uv, 1.));

		float d = Raymarch(ro, rd);

		vec3 col = vec3(0.0);

		// Virtual plane height (adjust as needed)
		float planeY = -1.0;

		if(d >= MAX_DIST) {
			// Check if ray intersects shadow plane
			if(rd.y < 0.0) {
				float t = -(ro.y - planeY) / rd.y;
				vec3 pos = ro + rd * t;
				
				// Calculate shadow
				vec3 lightDir = normalize(uLightPos - pos);
				float shadow = SoftShadow(pos, lightDir, 0.1, 10.0, 32.0);
				
				// Only show shadow and make non-shadow areas transparent
				float shadowStrength = 1.0 - shadow;
				col = vec3(0.0);
				gl_FragColor = vec4(col, shadowStrength * 0.95);
			} else {
				discard;
			}
		} else {
			vec3 p = ro + rd * d;
			vec3 n = GetNormal(p);
			col.rgb = n;
			gl_FragColor = vec4(col, 1.0);
		}
	}



`

export default fragmentShader
