const express = require('express');
const swaggerUi = require('swagger-ui-express');
const yamljs = require('yamljs');
const fs = require('fs');
const inventoryController = require('./controllers/inventoryController');
const menuController = require('./controllers/menuController');
const cashierController = require('./controllers/cashierController');
const predictionController = require('./controllers/predictionController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to handle JSON and URL encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes for inventory
app.post('/addInventory', inventoryController.addInventory);
app.get('/getInventoryItems', inventoryController.getInventoryItems);
app.get('/getInventoryHistory', inventoryController.getInventoryHistory);
app.post('/addMultipleInventory', inventoryController.addMultipleInventory);

// Routes for menu
app.post('/addMenu', menuController.addMenu);
app.get('/getMenuItems', menuController.getMenuItems);
app.put('/updateMenu', menuController.updateMenu);
app.delete('/deleteMenu/:id', menuController.deleteMenu);
app.post('/addMenuMultiply', menuController.addMenuMultiply);

// Routes for cashier
app.post('/upDataTestingTransaction', cashierController.upDataTestingTransaction);
app.get('/print-receipt/:transactionId', cashierController.printReceipt);
app.get('/getAllReceipts', cashierController.getAllReceipts);
app.post('/checkout', cashierController.checkout);

// Routes for prediction
app.post('/predict', predictionController.predict);

// Serve Swagger documentation
const swaggerDocument = yamljs.load('./swagger.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Listen on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
