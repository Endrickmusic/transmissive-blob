const fragmentShader = `

uniform float uTime;
uniform float progress;
uniform sampler2D texture01;
uniform vec4 uResolution;
uniform float dispersionOffset;
uniform float divideFactor;
uniform int count;

varying vec2 vUv;
varying vec4 vPosition;
varying vec4 vRayOrigin;
varying vec3 vHitPos;

float PI = 3.1415926;

#define MAX_STEPS 40
#define MAX_DIST 40.
#define SURF_DIST 1e-3
#define samples 32
#define LOD 

float GetDist(vec3 p) {

	float d = length(p) - 1.; // sphere
	d = length(vec2(length(p.xz) - .4, p.y)) - .1;
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

vec3 GetNormal(vec3 p) {
	vec2 e = vec2(1e-2, 0.);
	vec3 n = GetDist(p) - vec3(
		GetDist(p - e.xyy),
		GetDist(p - e.yxy),
		GetDist(p - e.yyx)
	);
	return normalize(n);
}

// vec3 GetNormal(in vec3 p) {
// 	vec2 e = vec2(1., -1.) * 1e-3;
//     return normalize(
//     	e.xyy * GetDist(p+e.xyy)+
//     	e.yxy * GetDist(p+e.yxy)+
//     	e.yyx * GetDist(p+e.yyx)+
//     	e.xxx * GetDist(p+e.xxx)
//     );
// }

	void main() {

		vec2 uv = vUv - 0.5;
		vec3 ro = vRayOrigin.xyz; //vec3(0., 0., -3.);
		vec3 rd = normalize(vHitPos - ro); //normalize(vec3(uv, 1.));

		float d = Raymarch(ro, rd);

		vec3 col = vec3(0.0);

		if ( d >= MAX_DIST )
			discard;
		else {
			vec3 p = ro + rd * d;
			vec3 n = GetNormal(p);
			col.rgb = n;
		}
        gl_FragColor = vec4(col, 1.0);
        // gl_FragColor = vec4(rd, 1.0);
	}



`

export default fragmentShader
