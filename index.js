const express = require('express');
const bodyParser = require('body-parser');
const inventoryController = require('./controllers/inventoryController');
const menuController = require('./controllers/menuController');
const cashierController = require('./controllers/cashierController');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Routes for inventory
app.post('/addInventory', inventoryController.addInventory);
app.get('/getInventoryItems', inventoryController.getInventoryItems);
app.get('/getInventoryHistory', inventoryController.getInventoryHistory);

// Routes for menu
app.post('/addMenu', menuController.addMenu);
app.get('/getMenuItems', menuController.getMenuItems);
app.put('/updateMenu', menuController.updateMenu);
app.delete('/deleteMenu/:id', menuController.deleteMenu);

// Routes for cashier
app.post('/checkout', cashierController.checkout);
app.get('/print-receipt/:transactionId', cashierController.printReceipt);
app.get('/getAllReceipts', cashierController.getAllReceipts);


// Listen on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
