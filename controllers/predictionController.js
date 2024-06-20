// controllers/predictionController.js

//const tf = require('@tensorflow/tfjs-node');

// Fungsi untuk memuat model dari file .h5
const loadModel = async () => {
  try {
    const model = await tf.loadLayersModel('../model/model_nn_1.h5');
    return model;
  } catch (error) {
    throw new Error(`Failed to load model: ${error.message}`);
  }
};

// Fungsi untuk melakukan prediksi berdasarkan data input
const predict = async (req, res) => {
  try {
    const model = await loadModel();
    const inputData = req.body.data; // Misalnya, data dikirim sebagai JSON

    // Lakukan prediksi
    const prediction = model.predict(tf.tensor([inputData]));

    // Kirim hasil prediksi sebagai respons
    res.json({ prediction: prediction.dataSync() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  predict
};
