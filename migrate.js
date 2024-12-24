const mongoose = require('mongoose');
const admin = require('firebase-admin');
const bcrypt = require('bcrypt');

admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey.json'),
});

const db = admin.firestore(); 

// MongoDB connection
const mongoUri = 'mongodb://192.168.1.165:27017/genesis'; 
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    migrateData();
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });


async function migrateData() {
  try {

    const usersCollection = mongoose.connection.db.collection('accounts');
    const users = await usersCollection.find().toArray(); 

    
    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const userRef = db.collection('accounts').doc();  
      await userRef.set({
        username: user.username,
        email: user.email,
        password: hashedPassword, // Save the hashed password
        admin: user.admin || false,
        wave: user.wave || 5,
        created_at: user.created_at || new Date(),
        ownsGame: user.ownsGame || false,
      });
      console.log(`Migrated user: ${user.username}`);
    }

    console.log('Migration completed!');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error during migration:', error);
  }
}
