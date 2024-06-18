const fragmentShader = `

uniform float uTime;
uniform float progress;
uniform sampler2D texture01;
uniform vec4 uResolution;
uniform float dispersionOffset;
uniform float divideFactor;
uniform int count;
uniform float uSize;

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

struct Surface {
    float sd; // signed distance value
    vec3 col; // color
};

Surface sdSphere(vec3 p, float r, vec3 offset, vec3 col)
{
  float d = length(p - offset) - r;
  return Surface(d, col);
}

Surface sdFloor(vec3 p, vec3 col) {
  float d = p.y + .5;
  return Surface(d, col);
}

Surface sdBox( vec3 p, vec3 b, vec3 col)
{
  vec3 q = abs(p) - b;
  float d = length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
  return Surface(d, col);
}

// float sphere(in vec3 p, in float r) { 
    // float d = length(p) - r; 

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

    // return d;
    // }

float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

Surface minWithColor(Surface obj1, Surface obj2) {
  if (obj2.sd < obj1.sd) return obj2; // The sd component of the struct holds the "signed distance" value
  return obj1;
}

Surface sdScene(vec3 p) {
  Surface sphereLeft = sdSphere(p, 0.15, vec3(-.2, 0, 0), vec3(0, .2, .8));
  Surface sphereRight = sdSphere(p, 0.15, vec3(.2, 0, 0), vec3(1, 0.58, 0.29));
  Surface co = minWithColor(sphereLeft, sphereRight); // co = closest object containing "signed distance" and color
  co = minWithColor(co, sdBox(p - vec3(0.,-.5, 0.), vec3(0.5, 0.01, 0.5), vec3(.5, .5, .5)));
  return co;
}

#define BALL_NUM 5

// float GetDist(vec3 p) {
// 	float d = 1e5;
// 	float plane = p.y + .5;
// 	for(int i = 0; i < BALL_NUM; i++) {
// 		float fi = float(i) + 0.01;
// 		float r = uSize * 0.1;
// 		// float r = uSize * 0.1 * hash(fi);
// 		vec3 offset = .5 * sin(hash3(fi)) * cos(uTime + float(i));
// 		d = opSmoothUnion(d, sphere(p - offset, r), 0.24);
// 	}
// 	d = opSmoothUnion(d, plane, 0.1);
// 	return d;
// }

// float Raymarch(vec3 ro, vec3 rd) {
// 	float dO = 0.;
// 	float dS;
// 	for (int i = 0; i < MAX_STEPS; i++) {
// 		vec3 p = ro + rd * dO;
// 		dS = GetDist(p);
// 		dO += dS;
// 		if (dS < SURF_DIST || dO > MAX_DIST) break;
// 	}
// 	return dO;
// }

Surface Raymarch(vec3 ro, vec3 rd, float start, float end) {
  float depth = start;
  Surface co; // closest object

  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + depth * rd;
    co = sdScene(p);
    depth += co.sd;
    if (co.sd < SURF_DIST || depth > end) break;
  }

  co.sd = depth;

  return co;
}

vec3 GetNormal(in vec3 p) {
	vec2 e = vec2(1., -1.) * 1e-3;
    return normalize(
    	e.xyy * sdScene(p + e.xyy).sd +
    	e.yxy * sdScene(p + e.yxy).sd +
    	e.yyx * sdScene(p + e.yyx).sd +
    	e.xxx * sdScene(p + e.xxx).sd
    );
}

float GetLight(vec3 p) {
	vec3 lightPos = vec3(0., 2., 0.);
	vec3 l = normalize(lightPos - p);
	vec3 n = GetNormal(p);
	float dif = clamp(dot(n, l), 0., 1.);
	float d = Raymarch(p + n * SURF_DIST * 2., l, 0., MAX_DIST).sd;
	if (d < length(lightPos - p)) dif *= 0.1;	
	return dif;
}

bool IsOnPlane(vec3 p) {
    float planeY = 0.5; // replace with the y-coordinate of your plane
    float epsilon = 0.04; // tolerance for floating point errors
    return abs(p.y + planeY) < epsilon;
}

	void main() {

		vec2 uv = vUv - 0.5;
		vec3 ro = vRayOrigin.xyz; //vec3(0., 0., -3.);
		vec3 rd = normalize(vHitPos - ro); //normalize(vec3(uv, 1.));

		// float d = Raymarch(ro, rd);
		Surface co = Raymarch(ro, rd, 0., MAX_DIST);

		vec3 col = vec3(0.0);
    float alpha = 1.0;

		if ( co.sd >= MAX_DIST )
			discard;
		else {
			vec3 p = ro + rd * co.sd;
			vec3 n = GetNormal(p);
			// col.rgb = n;
			float dif = GetLight(p);
            
        // if (IsOnPlane(p)) {
        //     alpha = 0.4 - dif; // alpha is 1.0 in shadow and 0.0 in light
        // } else {
            col = dif * co.col * 1.2;
            alpha = 1.0;
        // }
		}
        gl_FragColor = vec4(col, alpha);
        // gl_FragColor = vec4(rd, 1.0);
	}



`

export default fragmentShader
