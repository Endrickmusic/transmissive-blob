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

float sceneSDF( vec3 pos ) {
   float sdf = 1e10;

   //sdf = min(sdf, sphereSDF(pos, vec3(0,0,-10), 4.));
   //sdf = min(sdf, sphereSDF(pos, vec3(3,0,-5), 1.));
   
   const int balls = 24;
   for (int i=0; i<balls; i++) {
       float seed = mod(float(i)/float(balls) + 0.003 * iTime, 6.28318);
       vec2 seedvec = 0.4 * vec2(cos(seed), sin(seed)) + vec2(0.5);
       //vec3 r = texture(iChannel0, seedvec).xyz; // very choppy on slow speeds!
       vec3 r = smoothTexture(iChannel0, iChannelResolution[0].xy, seedvec).xyz;
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

    vec2 angle_offset = CAM_FOV * (fragCoord - iResolution.xy / 2.) / iResolution.xx; 
    vec3 ray  = CAM_DIR;
         ray += angle_offset.x * CAM_RIGHT;
         ray += angle_offset.y * CAM_UP;
    ray = normalize(ray);
    
    
    vec3 pos = CAM_POS;
    vec3 normal;
    fragColor = vec4(0,0,0,1);
    
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
            fragColor.rgb += part * color;

            ray = reflect(ray, normal);
            pos += 0.02 * ray;
            
            part *= 0.3;
        }
    }
}

`

export default fragmentShader
