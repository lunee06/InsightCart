const db = require('../firebase');

const addMenu = async (req, res) => {
    try {
        const { namaMenu, ingredients, harga } = req.body;

        if (!namaMenu || !ingredients || !harga) {
            return res.status(400).send('Nama menu, ingredients, dan harga harus disertakan.');
        }

        // Check if the menu name already exists
        const menuSnapshot = await db.collection('menu').where('namaMenu', '==', namaMenu).get();
        if (!menuSnapshot.empty) {
            return res.status(400).send(`Nama menu ${namaMenu} sudah ada.`);
        }

        // Check each ingredient in inventory
        for (const ingredient of ingredients) {
            const { nama, jumlah, satuan } = ingredient;

            const itemsSnapshot = await db.collection('barang').where('nama', '==', nama).get();

            if (itemsSnapshot.empty) {
                return res.status(400).send(`Ingredient ${nama} tidak ada di inventory.`);
            }

            const existingItem = itemsSnapshot.docs[0].data();

            if (existingItem.jumlah < jumlah) {
                return res.status(400).send(`Jumlah ingredient ${nama} tidak mencukupi. Tersedia: ${existingItem.jumlah} ${existingItem.satuan}`);
            }
        }

        // Add new menu
        const menuData = {
            namaMenu,
            ingredients,
            harga
        };
        await db.collection('menu').add(menuData);

        res.status(200).send('Menu ditambahkan.');
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const getMenuItems = async (req, res) => {
    try {
        const menuSnapshot = await db.collection('menu').get();
        const menuItems = menuSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.status(200).json(menuItems);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const updateMenu = async (req, res) => {
    try {
        const { id, namaMenu, ingredients, harga } = req.body;

        if (!id || !namaMenu || !ingredients || !harga) {
            return res.status(400).send('ID, Nama menu, ingredients, dan harga harus disertakan.');
        }

       // Check each ingredient in inventory
       for (const ingredient of ingredients) {
        const { nama, jumlah, satuan } = ingredient;

        const itemsSnapshot = await db.collection('barang').where('nama', '==', nama).get();

        if (itemsSnapshot.empty) {
            return res.status(400).send(`Ingredient ${nama} tidak ada di inventory.`);
        }

        const existingItem = itemsSnapshot.docs[0].data();

        if (existingItem.jumlah < jumlah) {
            return res.status(400).send(`Jumlah ingredient ${nama} tidak mencukupi. Tersedia: ${existingItem.jumlah} ${existingItem.satuan}`);
        }
    }

        // Update menu
        const menuRef = db.collection('menu').doc(id);
        const menuSnapshot = await menuRef.get();

        if (!menuSnapshot.exists) {
            return res.status(404).send('Menu tidak ditemukan.');
        }

        await menuRef.update({
            namaMenu,
            ingredients,
            harga
        });

        res.status(200).send('Menu diperbarui.');
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const deleteMenu = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send('ID menu harus disertakan.');
        }

        const menuRef = db.collection('menu').doc(id);
        const menuSnapshot = await menuRef.get();

        if (!menuSnapshot.exists) {
            return res.status(404).send('Menu tidak ditemukan.');
        }

        await menuRef.delete();

        res.status(200).send('Menu berhasil dihapus.');
    } catch (error) {
        res.status(500).send(error.message);
    }
};

module.exports = {
    addMenu,
    getMenuItems,
    updateMenu,
    deleteMenu
};
