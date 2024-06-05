const vertexShader = `
attribute vec4 vertexPosition;

uniform float uTime;

varying vec2 vUv;
varying vec3 vColor;
varying vec3 worldNormal;
varying vec3 eyeVector;

float PI = 3.141592;


void main() {

    vec4 worldPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewDirection = normalize(-worldPosition.xyz);
    
    // Output vertex position
    gl_Position = projectionMatrix * worldPosition;
    vUv = uv;

}

`

export default vertexShader
