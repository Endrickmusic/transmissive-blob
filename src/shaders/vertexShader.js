const vertexShader = `

uniform vec3 uCamPos;
uniform mat4 uInverseModelMat;

varying vec2 vUv;
varying vec4 vPosition;
varying vec4 vRayOrigin;
varying vec3 vHitPos;

void main() {

    vec4 worldPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewDirection = normalize(-worldPosition.xyz);
    
    // Output vertex position
    gl_Position = projectionMatrix * worldPosition;
    vUv = uv;
    vPosition = worldPosition;
    vRayOrigin = vec4(uCamPos, 1.0) * uInverseModelMat;
    // vHitPos = worldPosition.xyz;
    vHitPos = position;
}

`

export default vertexShader
