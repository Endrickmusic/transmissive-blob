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
uniform float uIOR;
uniform float uReflection;
uniform float uDispersion;
uniform sampler2D uTexture;
uniform sampler2D uNoiseTexture;
uniform samplerCube iChannel0;
uniform float uMetallic;
uniform float uRoughness;
uniform vec3 uAlbedo;
uniform vec3 uLightPosition;
uniform vec3 uLightColor;

varying vec2 vUv;
varying vec4 vPosition;
varying vec4 vRayOrigin;
varying vec3 vHitPos;

const float PI = 3.1415926;
const float HALF_PI = 0.5 * PI;
const float TWO_PI = 2.0 * PI;
const int LOOP = 16;

#define MAX_STEPS 128
#define MAX_DIST 100.0
#define SURF_DIST 1e-4
#define LOOP 8
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

// float cubeSDF(vec3 p, vec3 size) {
//     vec3 q = abs(p) - size;
//     return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
// }

// float GetDist(vec3 p) {
// 	float d = cubeSDF(p, vec3(0.2));
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
		// d = opSmoothUnion(d, sphere(p, r), 0.24);
	}
	return d;
}

float Raymarch(vec3 ro, vec3 rd, float side) {
	float dO = 0.;
	float dS;
	for (int i = 0; i < MAX_STEPS; i++) {
		vec3 p = ro + rd * dO;
		dS = GetDist(p) * side;
		dO += dS;
		if (dS < SURF_DIST || dO > MAX_DIST) break;
	}
	return dO;
}

vec3 GetNormal(in vec3 p) {
	vec2 e = vec2(1., -1.) * 1e-3;
    return normalize(
    	e.xyy * GetDist(p + e.xyy) +
    	e.yxy * GetDist(p + e.yxy) +
    	e.yyx * GetDist(p + e.yyx) +
    	e.xxx * GetDist(p + e.xxx)
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

float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}

float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 calculatePBR(vec3 worldPos, vec3 N) {
    vec3 V = normalize(vRayOrigin.xyz - worldPos);
    vec3 L = normalize(uLightPosition - worldPos);
    vec3 H = normalize(V + L);

    // Calculate base reflectivity
    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, uAlbedo, uMetallic);

    // Cook-Torrance BRDF
    float NDF = DistributionGGX(N, H, uRoughness);
    float G = GeometrySmith(N, V, L, uRoughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    vec3 specular = numerator / denominator;

    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - uMetallic;

    float NdotL = max(dot(N, L), 0.0);

    // Final combination
    vec3 Lo = (kD * uAlbedo / PI + specular) * uLightColor * NdotL;

    // Ambient lighting
    vec3 ambient = vec3(0.03) * uAlbedo;

    return ambient + Lo;
}

void main() {
vec2 uv = vUv - 0.5;
vec3 ro = vRayOrigin.xyz; //vec3(0., 0., -3.);
vec3 rd = normalize(vHitPos - ro); //normalize(vec3(uv, 1.));

float d = Raymarch(ro, rd, 1.0);

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

		// Calculate PBR lighting
		vec3 pbrColor = calculatePBR(p, n);

		// reflection
		vec3 refl = reflect(rd, n);
		vec3 reflOutside = texture2D(iChannel0, refl).rgb;

		// refraction
		vec3 refractIn = refract(rd, n, 1. / uIOR);

		// refract out
		float iorRatioRed = uIOR + uDispersion;
		float iorRatioGreen = uIOR;
		float iorRatioBlue = uIOR - uDispersion;

		vec3 pEnter = p - n * SURF_DIST * 3.0;

		float dIn = Raymarch(pEnter, refractIn, -1.0);

		vec3 pExit = pEnter + refractIn * dIn;

		vec3 nExit = - GetNormal(pExit);

	for ( int i = 0; i < LOOP; i ++ ) {
    	float slide = float(i) / float(LOOP) * 0.1;

    	vec3 refractVecR = refract(refractIn, nExit, iorRatioRed);
		if(dot(refractVecR, refractVecR) == 0.0) refractVecR = reflect(refractIn, nExit);
		col.r += textureCube(iChannel0, refractVecR * (slide * 1.0)).r;

    	vec3 refractVecG = refract(refractIn, nExit, iorRatioGreen);
		if(dot(refractVecG, refractVecG) == 0.0) refractVecG = reflect(refractIn, nExit);
		col.g += textureCube(iChannel0, refractVecG * (slide * 2.0)).g;	

    	vec3 refractVecB = refract(refractIn, nExit, iorRatioBlue);
		if(dot(refractVecB, refractVecB) == 0.0) refractVecB = reflect(refractIn, nExit);
		col.b += textureCube(iChannel0, refractVecB * (slide * 3.0)).b;
	}

// Divide by the number of layers to normalize colors (rgb values can be worth up to the value of LOOP)
		col /= float( LOOP );

        // fresnel
        float fresnel = pow(1. + dot(rd, n), uReflection);

        vec3 finalColor = mix(col, reflOutside, fresnel); 
        
        // Blend PBR with your existing refraction/reflection
        finalColor = mix(finalColor, pbrColor, 0.5); // Adjust mix factor as needed

        // Apply tone mapping and gamma correction
        finalColor = finalColor / (finalColor + vec3(1.0));
        finalColor = pow(finalColor, vec3(1.0/2.2));

		gl_FragColor = vec4(finalColor, 1.0);
		}
	}



`

export default fragmentShader
