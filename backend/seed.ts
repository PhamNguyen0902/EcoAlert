import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const atlasUri =
  "mongodb+srv://son123:son123@cluster0.piq0xrr.mongodb.net"; // Dán chuỗi của bạn vào đây
// Setup Mongoose connections
const userDb = mongoose.createConnection(
  `${atlasUri}/ecoalert-user-db?retryWrites=true&w=majority`,
);
const alertDb = mongoose.createConnection(
  `${atlasUri}/ecoalert-alert-db?retryWrites=true&w=majority`,
);
const gisDb = mongoose.createConnection(
  `${atlasUri}/ecoalert-gis-db?retryWrites=true&w=majority`,
);

// const userDb = mongoose.createConnection(userDbUri);
// const alertDb = mongoose.createConnection(alertDbUri);
// const gisDb = mongoose.createConnection(gisDbUri);

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
      { email: 'citizen4@ecoalert.local', passwordHash: hashPassword('citizen123'), firstName: 'David', lastName: 'Clark', role: 'CITIZEN', isVerified: true, isActive: true },
      { email: 'citizen5@ecoalert.local', passwordHash: hashPassword('citizen123'), firstName: 'Eve', lastName: 'Davis', role: 'CITIZEN', isVerified: true, isActive: true },
    ]);

    const admin = users[0];
    const officer1 = users[1];
    const officer2 = users[2];
    const citizen1 = users[3];
    const citizen2 = users[4];
    const citizen3 = users[5];
    const citizen4 = users[6];
    const citizen5 = users[7];

    console.log('Seeding Alerts & Locations...');
    // Base coordinate: Ho Chi Minh City roughly [106.6297, 10.8231]
    const alertsData = [
      { citizenId: citizen1._id, title: 'Waste Dumping in Park', description: 'Someone dumped trash.', category: 'ILLEGAL_DUMPING', status: 'PENDING', severity: 'MEDIUM', address: 'Park A', location: { type: 'Point', coordinates: [106.63, 10.82] } },
      { citizenId: citizen2._id, title: 'Fallen Tree on Road', description: 'Tree blocking road.', category: 'FALLEN_TREE', status: 'VERIFIED', severity: 'HIGH', address: 'Street B', location: { type: 'Point', coordinates: [106.64, 10.83] } },
      { citizenId: citizen3._id, title: 'Flooded Street', description: 'Water level high.', category: 'FLOODING', status: 'ASSIGNED', severity: 'HIGH', assignedOfficerId: officer1._id, address: 'Street C', location: { type: 'Point', coordinates: [106.65, 10.81] } },
      { citizenId: citizen4._id, title: 'Air Pollution from Factory', description: 'Black smoke.', category: 'AIR_POLLUTION', status: 'IN_PROGRESS', severity: 'CRITICAL', assignedOfficerId: officer2._id, address: 'Factory Zone', location: { type: 'Point', coordinates: [106.66, 10.84] } },
      { citizenId: citizen5._id, title: 'Water Pollution', description: 'Chemical spill.', category: 'WATER_POLLUTION', status: 'RESOLVED', severity: 'CRITICAL', assignedOfficerId: officer1._id, address: 'River X', location: { type: 'Point', coordinates: [106.62, 10.85] } },
      { citizenId: citizen1._id, title: 'Illegal Burning', description: 'Burning trash.', category: 'ILLEGAL_BURNING', status: 'CLOSED', severity: 'LOW', assignedOfficerId: officer2._id, address: 'Empty Lot', location: { type: 'Point', coordinates: [106.61, 10.80] } },
      { citizenId: citizen2._id, title: 'Dead Animal', description: 'Dead dog on road.', category: 'DEAD_ANIMAL', status: 'PENDING', severity: 'LOW', address: 'Highway 1', location: { type: 'Point', coordinates: [106.67, 10.86] } },
      { citizenId: citizen3._id, title: 'Blocked Drain', description: 'Drain is clogged.', category: 'BLOCKED_DRAIN', status: 'PENDING', severity: 'MEDIUM', address: 'Alley 2', location: { type: 'Point', coordinates: [106.68, 10.87] } },
      { citizenId: citizen4._id, title: 'Dangerous Infrastructure', description: 'Broken electrical pole.', category: 'DANGEROUS_INFRASTRUCTURE', status: 'VERIFIED', severity: 'HIGH', address: 'Street D', location: { type: 'Point', coordinates: [106.69, 10.88] } },
      { citizenId: citizen5._id, title: 'Noise Pollution', description: 'Loud construction at night.', category: 'NOISE_POLLUTION', status: 'PENDING', severity: 'LOW', address: 'Building E', location: { type: 'Point', coordinates: [106.60, 10.79] } },
      { citizenId: citizen1._id, title: 'Pothole on Main Street', description: 'Huge pothole.', category: 'DANGEROUS_INFRASTRUCTURE', status: 'PENDING', severity: 'MEDIUM', address: 'Main St', location: { type: 'Point', coordinates: [106.635, 10.825] } },
      { citizenId: citizen2._id, title: 'Smell of Gas', description: 'Strong gas smell.', category: 'AIR_POLLUTION', status: 'VERIFIED', severity: 'CRITICAL', address: 'Block F', location: { type: 'Point', coordinates: [106.645, 10.835] } },
      { citizenId: citizen3._id, title: 'River Trash', description: 'Plastics in river.', category: 'WATER_POLLUTION', status: 'ASSIGNED', severity: 'HIGH', assignedOfficerId: officer1._id, address: 'River Y', location: { type: 'Point', coordinates: [106.655, 10.815] } },
      { citizenId: citizen4._id, title: 'Traffic light broken', description: 'Light not working.', category: 'DANGEROUS_INFRASTRUCTURE', status: 'IN_PROGRESS', severity: 'MEDIUM', assignedOfficerId: officer2._id, address: 'Crossroad', location: { type: 'Point', coordinates: [106.665, 10.845] } },
      { citizenId: citizen5._id, title: 'Stray Dogs', description: 'Pack of aggressive dogs.', category: 'OTHER', status: 'RESOLVED', severity: 'LOW', assignedOfficerId: officer1._id, address: 'Park B', location: { type: 'Point', coordinates: [106.625, 10.855] } },
      { citizenId: citizen1._id, title: 'Fire at warehouse', description: 'Smoke coming out.', category: 'AIR_POLLUTION', status: 'CLOSED', severity: 'CRITICAL', assignedOfficerId: officer2._id, address: 'Warehouse C', location: { type: 'Point', coordinates: [106.615, 10.805] } },
      { citizenId: citizen2._id, title: 'Chemical barrels', description: 'Abandoned barrels.', category: 'ILLEGAL_DUMPING', status: 'PENDING', severity: 'HIGH', address: 'Highway 2', location: { type: 'Point', coordinates: [106.675, 10.865] } },
      { citizenId: citizen3._id, title: 'Overflowing Bin', description: 'Trash bin is full.', category: 'ILLEGAL_DUMPING', status: 'PENDING', severity: 'LOW', address: 'Alley 3', location: { type: 'Point', coordinates: [106.685, 10.875] } },
      { citizenId: citizen4._id, title: 'Bridge Damage', description: 'Cracks on bridge.', category: 'DANGEROUS_INFRASTRUCTURE', status: 'VERIFIED', severity: 'CRITICAL', address: 'Bridge D', location: { type: 'Point', coordinates: [106.695, 10.885] } },
      { citizenId: citizen5._id, title: 'Loud Music Party', description: 'Late night noise.', category: 'NOISE_POLLUTION', status: 'PENDING', severity: 'LOW', address: 'Building G', location: { type: 'Point', coordinates: [106.605, 10.795] } },
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
