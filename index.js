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



// Listen on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
