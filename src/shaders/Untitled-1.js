//@input SceneObject cam
//@input Asset.Material mat
//@input float scale = 1.0; // Scaling factor for location values
//@input vec3 rotationOffset // Rotation offset in degrees

// Get the current position of camera
var currentPosition = script.cam.getTransform().getWorldPosition()
//script.mat.mainPass.camPos = script.cam.getTransform().getWorldPosition();

// Scale the position values
var scaledPosition = new vec3(
  currentPosition.x * script.scale,
  currentPosition.y * script.scale,
  currentPosition.z * script.scale
)

// Assign the scaled position to the shader material
script.mat.mainPass.camPos = scaledPosition

// Print the current position to the console
print("Current Position: " + currentPosition)

// Get the current position of camera
var currentRotation = script.cam
  .getTransform()
  .getWorldRotation()
  .toEulerAngles()
//script.mat.mainPass.camRot = script.cam.getTransform().getWorldRotation();
script.mat.mainPass.camRot = script.cam
  .getTransform()
  .getWorldRotation()
  .toEulerAngles()

// Apply rotation offset
var adjustedRotation = new vec3(
  -(currentRotation.x + script.rotationOffset.x),
  -(currentRotation.y + script.rotationOffset.y),
  -(currentRotation.z + script.rotationOffset.z)
)

// Assign the adjusted rotation to the shader material
script.mat.mainPass.camRot = adjustedRotation

// Print the current position to the console
print("Current Rotation: " + currentRotation)
