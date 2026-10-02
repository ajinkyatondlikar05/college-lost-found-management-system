const Category = require('../models/Category');

const DEFAULT_CATEGORIES = [
  { name: 'Wallet', description: 'Wallets, purses, and money holders', icon: 'wallet' },
  { name: 'Bag', description: 'Backpacks, handbags, duffels, and pouches', icon: 'shopping-bag' },
  { name: 'Mobile Phone', description: 'Smartphones, iPhones, and Android devices', icon: 'smartphone' },
  { name: 'Watches', description: 'Wristwatches, smartwatches, and fitness trackers', icon: 'watch' },
  { name: 'Electronics', description: 'Laptops, chargers, headphones, power banks', icon: 'cpu' },
  { name: 'Books & Notes', description: 'Notebooks, textbooks, and study materials', icon: 'book' },
  { name: 'Clothing', description: 'Jackets, sweaters, caps, and scarves', icon: 'user' },
  { name: 'Accessories', description: 'Glasses, water bottles, umbrellas, jewelry', icon: 'tag' },
  { name: 'Keys', description: 'Keys, keychains, and vehicle keys', icon: 'key' },
  { name: 'Other', description: 'Miscellaneous lost or found items', icon: 'box' },
];

async function seedCategories() {
  try {
    const count = await Category.countDocuments();
    if (count === 0) {
      console.log('Seeding initial categories in MongoDB...');
      await Category.insertMany(DEFAULT_CATEGORIES);
      console.log('Default categories successfully seeded.');
    }
  } catch (err) {
    console.error('Error seeding categories:', err.message);
  }
}

module.exports = seedCategories;
