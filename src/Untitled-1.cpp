// The shader output color
output_vec4 fragColor;

input_vec3 camPos;
input_texture_2d camTexture;
input_vec2 surfaceUV;
input_vec3 boxSize;
input_vec3 boxPos;
input_float checkScale;
input_vec3 lightPos;
input_float floorPos;
input_float sphereSize;
input_vec3 spherePos;

input_mat4 uCamToWorldMat;

const int MAX_MARCHING_STEPS = 255;
const float MIN_DIST = 0.01;
const float MAX_DIST = 5000.0;
const float PRECISION = 0.001;

struct Surface {
    float sd; // signed distance value
    vec3 col; // color
};

Surface sdBox(vec3 p, vec3 b, vec3 col, mat3 transform) {
    p = (p - boxPos) * transform; // apply transformation matrix
    vec3 q = abs(p) - b;
    float d = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
    return Surface(d, col);
}

Surface sdFloor(vec3 p, vec3 col) {
    float d = p.y + floorPos;
    return Surface(d, col);
}

Surface sdSphere(vec3 p, float r, vec3 col)
{
  float d = length(p)-r;
  return Surface(d, col);
}

Surface minWithColor(Surface obj1, Surface obj2) {
    if (obj2.sd < obj1.sd) return obj2;
    return obj1;
}

Surface sdScene(vec3 p) {
	vec3 floorColor = vec3(1.0 + 1.7 * mod(floor(p.x * checkScale) + floor(p.z * checkScale), 2.));
    Surface co = sdFloor(p, floorColor);
    co = minWithColor(co, sdSphere(p - spherePos, sphereSize, vec3(1, 0, 0)));
    return co;
}

Surface rayMarch(vec3 ro, vec3 rd, float start, float end) {
    float depth = start;
    Surface co; // closest object

    for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
        vec3 p = ro + depth * rd;
        co = sdScene(p);
        depth += co.sd;
        if (co.sd < PRECISION || depth > end) break;
    }

    co.sd = depth;

    return co;
}

vec3 calcNormal(in vec3 p) {
    vec2 e = vec2(1.0, -1.0) * 0.0005; // epsilon
    return normalize(
        e.xyy * sdScene(p + e.xyy).sd +
        e.yyx * sdScene(p + e.yyx).sd +
        e.yxy * sdScene(p + e.yxy).sd +
        e.xxx * sdScene(p + e.xxx).sd);
}

void main() {

    vec2 fragCoord = system.getSurfaceUVCoord0() * camTexture.textureSize();
	vec2 uv = surfaceUV;

	// Camera background
	vec3 backgroundColor = camTexture.sample(surfaceUV).rgb;

    vec3 col = vec3(0);
    vec3 ro = camPos; // ray origin that represents camera position
	vec3 rd = (system.getMatrixProjectionInverse() * vec4(uv * 2.0 - 1.0, 0.0, 1.0)).xyz;
	
	rd = (uCamToWorldMat * vec4(rd, 0.0)).xyz;
    rd = normalize(rd);

    Surface co = rayMarch(ro, rd, MIN_DIST, MAX_DIST); // closest object

    if (co.sd > MAX_DIST) {
        col = backgroundColor; // ray didn't hit anything
    } else {
        vec3 p = ro + rd * co.sd; // point on cube or floor discovered from ray marching
        vec3 normal = calcNormal(p);

        vec3 lightDirection = normalize(lightPos - p);

        float dif = clamp(dot(normal, lightDirection), 0.3, 1.0); // diffuse reflection

        col = dif * co.col + backgroundColor * 0.2; // Add a bit of background color to the diffuse color
    }

    // Output to screen
    fragColor = vec4(col, 1.0);
}