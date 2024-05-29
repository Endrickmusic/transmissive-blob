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

// yes, I know things like Camera Matrices and Quaternions exist..
// but this is just how the math lives in my head..

const float CAM_FOV = 2.0;        // field of view
const vec3 CAM_POS = vec3(0, 0, 5.);     // coordinates of camera
const vec3 CAM_DIR = vec3(0,0,-1); // unit vector pointing in cam direction
const vec3 CAM_UP  = vec3(0,1,0); // unit vector pointing up
const vec3 CAM_RIGHT = cross(CAM_DIR, CAM_UP);

float sphereSDF( vec3 pos, vec3 center, float radius )
{
    return length(center - pos) - radius;
}

// this function is from https://iquilezles.org/articles/distfunctions/
float smin( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h); }


// like 'texture', but with my own interpolation filter based on smoothstep.
vec4 smoothTexture(sampler2D channel, vec2 res, vec2 pos) {
  ivec2 ipos = ivec2(pos * res - vec2(.5));
  vec4 tl = texelFetch(channel, ipos + ivec2(0,0), 0);
  vec4 tr = texelFetch(channel, ipos + ivec2(1,0), 0);
  vec4 bl = texelFetch(channel, ipos + ivec2(0,1), 0);
  vec4 br = texelFetch(channel, ipos + ivec2(1,1), 0);
  vec2 d = smoothstep(0., 1., fract(pos * res - vec2(.5)));
  vec4 a = mix(tl, tr, d.x);
  vec4 b = mix(bl, br, d.x);
  vec4 c = mix(a, b, d.y);
  return c;
}


float sceneSDF( vec3 pos ) {
   float sdf = 1e10;

   //sdf = min(sdf, sphereSDF(pos, vec3(0,0,-10), 4.));
   //sdf = min(sdf, sphereSDF(pos, vec3(3,0,-5), 1.));
   vec2 uv = vUv * 2. - 1.;
   const int balls = 24;
   for (int i=0; i<balls; i++) {
       float seed = mod(float(i)/float(balls) + 0.003 * uTime, 6.28318);
       vec2 seedvec = 0.4 * vec2(cos(seed), sin(seed)) + vec2(0.5);
    //    vec3 r = texture(texture01, seedvec).xyz; // very choppy on slow speeds!
       vec3 r = smoothTexture(texture01, uv, seedvec).xyz;
       r.x = mix(-8.,8.,r.x);
       r.y = mix(-8.,8.,r.y);
       r.z = -mix(5.,20.,r.z);
       sdf = smin(sdf, sphereSDF(pos, r, 1.5), 2.);
   }

   return sdf;
}

void main()
{
    // CALCULATE DIRECTION OF RAY

    // vec2 angle_offset = CAM_FOV * (gl_FragCoord.xy - uResolution.xy / 2.) / uResolution.xx; 
    vec2 uv = vUv * 2. - 1.;
    vec2 angle_offset = CAM_FOV * uv; 
    vec3 ray  = CAM_DIR;
         ray += angle_offset.x * CAM_RIGHT;
         ray += angle_offset.y * CAM_UP;
    ray = normalize(ray);
    
    
    vec3 pos = CAM_POS;
    vec3 normal;
    gl_FragColor = vec4(0,0,0,1);
    
    float part = 1.;


    for (int i=0; i<40; i++) {

        // MARCH FORWARD
        float dist = sceneSDF(pos);
        pos += ray * dist;

        if (dist < 0.01) {
            // GET NORMAL

            vec2 eps = vec2(0.01,0);

            normal.x = sceneSDF( pos + eps.xyy ) - sceneSDF( pos - eps.xyy );
            normal.y = sceneSDF( pos + eps.yxy ) - sceneSDF( pos - eps.yxy );
            normal.z = sceneSDF( pos + eps.yyx ) - sceneSDF( pos - eps.yyx );
            normal = normalize(normal);

            // REFLECT

            vec3 color = (normal + 1.) / 2.;
            // color = texture(iChannel1, color.xy).xyz; // use your camera!
            gl_FragColor.rgb += part * color;

            ray = reflect(ray, normal);
            pos += 0.02 * ray;
            
            part *= 0.3;
        }
    }
}

`

export default fragmentShader
