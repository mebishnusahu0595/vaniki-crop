
const mongoose = require('mongoose');
const mongoUri = 'mongodb://localhost:27017/vaniki-crop';
mongoose.connect(mongoUri).then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({ role: String, isActive: Boolean, approvalStatus: String }));
  const Store = mongoose.model('Store', new mongoose.Schema({ name: String, isActive: Boolean, adminId: mongoose.Schema.Types.ObjectId, address: Object, location: Object }));
  
  const approvedAdmins = await User.find({
    role: 'storeAdmin',
    isActive: true,
    $or: [
      { approvalStatus: 'approved' },
      { approvalStatus: { $exists: false } },
      { approvalStatus: null }
    ]
  }).select('_id');
  const approvedAdminIds = approvedAdmins.map(a => a._id);
  console.log('Approved Admin IDs:', approvedAdminIds);

  const stores = await Store.find({
    isActive: true,
    adminId: { $in: approvedAdminIds }
  });
  console.log('Stores found:', stores.length);
  if (stores.length > 0) {
    console.log('Store Name:', stores[0].name);
  }
  
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
