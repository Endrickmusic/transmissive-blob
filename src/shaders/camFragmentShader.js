const fragmentShader = `

uniform float uTime;
uniform vec2 uMouse;
uniform samplerCube iChannel0;
uniform float progress;
uniform sampler2D texture01;
uniform vec4 uResolution;
uniform float dispersionOffset;
uniform float divideFactor;
uniform int count;

varying vec2 vUv;

const float PI = 3.14159265359;
const float HALF_PI = 0.5*PI;
const float TWO_PI = 2.0*PI;

float hash(in float v) { return fract(sin(v)*43237.5324); }
vec3 hash3(in float v) { return vec3(hash(v), hash(v*99.), hash(v*9999.)); }

float sphere(in vec3 p, in float r) { return length(p)-r; }
float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

#define BALL_NUM 10
float map(in vec3 p) {
  float res = 1e5;
  for(int i=0;i<BALL_NUM;i++) {
    float fi = float(i)+1.;
    float r = 0.+1.5*hash(fi);
    vec3 offset = 2.*sin(hash3(fi)*iTime);
    res = opSmoothUnion(res, sphere(p-offset, r), 0.75);
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
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 p = (fragCoord.xy*2. - iResolution.xy) / min(iResolution.x, iResolution.y);
    vec3 color = vec3(0.);

    vec3 ro = 5.*vec3(cos(iTime*1.1), 0., sin(iTime*1.1));
    ro = vec3(0., 0., 5.);
    vec3 rd = normalize(lookAt(ro, vec3(0.), 0.) * vec3(p,  2.));

    
    vec2 tmm = vec2(0., 10.);
    float t = 0.;
    for(int i=0;i<200;i++) {
        float tmp = map(ro + rd*t);
        if(tmp<0.001 || tmm.y<t) break;
        t += tmp*0.7;
    }
  
    if(tmm.y<t) {// background
        color = vec3(0.);
    } else {// object
        vec3 pos = ro + rd*t;
        vec3 nor = normal(pos);
        vec3 ref = reflect(rd, nor);

        vec2 texCoord = ref.xy*0.5+0.5;
        color = texture(iChannel0, texCoord).rgb;
        color += vec3(pow(1.-clamp(dot(-rd, nor), 0., 1.), 2.));
    }
    fragColor = vec4(color, 1.);
}

`

export default fragmentShader
