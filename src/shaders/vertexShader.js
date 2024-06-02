const vertexShader = `
attribute vec4 vertexPosition;

uniform float uTime;

varying vec2 vUv;
varying vec3 vColor;
varying vec3 worldNormal;
varying vec3 eyeVector;

float PI = 3.141592;


void main() {

      vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
    vUv = uv;
    vec3 transformedNormal = normalMatrix * normal;
    worldNormal = normalize(transformedNormal);

    eyeVector = normalize(worldPos.xyz - cameraPosition);
}

`

export default vertexShader
