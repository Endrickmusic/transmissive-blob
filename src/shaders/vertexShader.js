const vertexShader = `

varying vec2 vUv;
varying vec4 vPosition;

void main() {

    vec4 worldPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewDirection = normalize(-worldPosition.xyz);
    
    // Output vertex position
    gl_Position = projectionMatrix * worldPosition;
    vUv = uv;
    vPosition = worldPosition;

}

`

export default vertexShader
