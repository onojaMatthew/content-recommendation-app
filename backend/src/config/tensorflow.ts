import * as tf from '@tensorflow/tfjs';

// Enable GPU acceleration if available
tf.setBackend('tensorflow');

// Memory management
tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);

export const initializeTF = async (): Promise<void> => {
  await tf.ready();
  console.log(`TensorFlow.js backend: ${tf.getBackend()}`);
};

export default tf;