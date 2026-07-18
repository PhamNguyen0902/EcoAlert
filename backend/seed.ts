import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

// Setup Mongoose connections
const userDbUri = 'mongodb://localhost:27017/ecoalert-user-db';
const alertDbUri = 'mongodb://localhost:27017/ecoalert-alert-db';
const gisDbUri = 'mongodb://localhost:27017/ecoalert-gis-db';

const userDb = mongoose.createConnection(userDbUri);
const alertDb = mongoose.createConnection(alertDbUri);
const gisDb = mongoose.createConnection(gisDbUri);

// Define Schemas manually for seeding to avoid complex imports
const userSchema = new mongoose.Schema({
  email: String,
  passwordHash: String,
  firstName: String,
  lastName: String,
  role: String,
  phoneNumber: String,
  isVerified: Boolean,
  isActive: Boolean,
}, { timestamps: true });

const alertSchema = new mongoose.Schema({
  citizenId: String,
  title: String,
  description: String,
  category: String,
  status: String,
  severity: String,
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  address: String,
  mediaUrls: [String],
  assignedOfficerId: String,
}, { timestamps: true });

const locationSchema = new mongoose.Schema({
  alertId: String,
  category: String,
  severity: String,
  status: String,
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
}, { timestamps: true });

const User = userDb.model('User', userSchema);
const Alert = alertDb.model('Alert', alertSchema);
const Location = gisDb.model('Location', locationSchema);

async function seed() {
  try {
    console.log('Clearing old data...');
    await User.deleteMany({});
    await Alert.deleteMany({});
    await Location.deleteMany({});

    console.log('Seeding Users...');
    const hashPassword = (pw: string) => bcrypt.hashSync(pw, 10);

    const users = await User.insertMany([
      { email: 'admin@ecoalert.local', passwordHash: hashPassword('admin123'), firstName: 'Super', lastName: 'Admin', role: 'ADMIN', isVerified: true, isActive: true },
      { email: 'officer1@ecoalert.local', passwordHash: hashPassword('officer123'), firstName: 'John', lastName: 'Doe', role: 'OFFICER', isVerified: true, isActive: true },
      { email: 'officer2@ecoalert.local', passwordHash: hashPassword('officer123'), firstName: 'Jane', lastName: 'Smith', role: 'OFFICER', isVerified: true, isActive: true },
      { email: 'citizen1@ecoalert.local', passwordHash: hashPassword('citizen123'), firstName: 'Alice', lastName: 'Johnson', role: 'CITIZEN', isVerified: true, isActive: true },
      { email: 'citizen2@ecoalert.local', passwordHash: hashPassword('citizen123'), firstName: 'Bob', lastName: 'Williams', role: 'CITIZEN', isVerified: true, isActive: true },
      { email: 'citizen3@ecoalert.local', passwordHash: hashPassword('citizen123'), firstName: 'Charlie', lastName: 'Brown', role: 'CITIZEN', isVerified: true, isActive: true },
    ]);

    const admin = users[0];
    const officer1 = users[1];
    const officer2 = users[2];
    const citizen1 = users[3];
    const citizen2 = users[4];
    const citizen3 = users[5];

    console.log('Seeding Alerts & Locations...');
    // Base coordinate: Ho Chi Minh City roughly [106.6297, 10.8231]
    const alertsData = [
      { citizenId: citizen1._id, title: 'Waste Dumping in Park', description: 'Someone dumped trash.', category: 'ILLEGAL_DUMPING', status: 'PENDING', severity: 'MEDIUM', address: 'Park A', location: { type: 'Point', coordinates: [106.63, 10.82] } },
      { citizenId: citizen2._id, title: 'Fallen Tree on Road', description: 'Tree blocking road.', category: 'FALLEN_TREE', status: 'VERIFIED', severity: 'HIGH', address: 'Street B', location: { type: 'Point', coordinates: [106.64, 10.83] } },
      { citizenId: citizen3._id, title: 'Flooded Street', description: 'Water level high.', category: 'FLOODING', status: 'ASSIGNED', severity: 'HIGH', assignedOfficerId: officer1._id, address: 'Street C', location: { type: 'Point', coordinates: [106.65, 10.81] } },
      { citizenId: citizen1._id, title: 'Air Pollution from Factory', description: 'Black smoke.', category: 'AIR_POLLUTION', status: 'IN_PROGRESS', severity: 'CRITICAL', assignedOfficerId: officer2._id, address: 'Factory Zone', location: { type: 'Point', coordinates: [106.66, 10.84] } },
      { citizenId: citizen2._id, title: 'Water Pollution', description: 'Chemical spill.', category: 'WATER_POLLUTION', status: 'RESOLVED', severity: 'CRITICAL', assignedOfficerId: officer1._id, address: 'River X', location: { type: 'Point', coordinates: [106.62, 10.85] } },
      { citizenId: citizen3._id, title: 'Illegal Burning', description: 'Burning trash.', category: 'ILLEGAL_BURNING', status: 'CLOSED', severity: 'LOW', assignedOfficerId: officer2._id, address: 'Empty Lot', location: { type: 'Point', coordinates: [106.61, 10.80] } },
      { citizenId: citizen1._id, title: 'Dead Animal', description: 'Dead dog on road.', category: 'DEAD_ANIMAL', status: 'PENDING', severity: 'LOW', address: 'Highway 1', location: { type: 'Point', coordinates: [106.67, 10.86] } },
      { citizenId: citizen2._id, title: 'Blocked Drain', description: 'Drain is clogged.', category: 'BLOCKED_DRAIN', status: 'PENDING', severity: 'MEDIUM', address: 'Alley 2', location: { type: 'Point', coordinates: [106.68, 10.87] } },
      { citizenId: citizen3._id, title: 'Dangerous Infrastructure', description: 'Broken electrical pole.', category: 'DANGEROUS_INFRASTRUCTURE', status: 'VERIFIED', severity: 'HIGH', address: 'Street D', location: { type: 'Point', coordinates: [106.69, 10.88] } },
      { citizenId: citizen1._id, title: 'Noise Pollution', description: 'Loud construction at night.', category: 'NOISE_POLLUTION', status: 'PENDING', severity: 'LOW', address: 'Building E', location: { type: 'Point', coordinates: [106.60, 10.79] } },
    ];

    const alerts = await Alert.insertMany(alertsData);

    const locationsData = alerts.map(a => ({
      alertId: a._id.toString(),
      category: a.category,
      severity: a.severity,
      status: a.status,
      location: a.location
    }));

    await Location.insertMany(locationsData);

    console.log('Seeding Complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
}

seed();
