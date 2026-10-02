const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const User = require('../models/User');
const Category = require('../models/Category');
const Claim = require('../models/Claim');
const Otp = require('../models/Otp');

describe('Mongoose Models In-Memory Schema Validation', () => {
  describe('Item Model', () => {
    it('should validate a complete and valid item', () => {
      const item = new Item({
        title: 'Blue Water Bottle',
        category: 'Accessories',
        description: 'Stainless steel bottle left in Room 302',
        location: 'Room 302',
        date: new Date(),
        type: 'lost',
        reportedBy: new mongoose.Types.ObjectId(),
      });

      const err = item.validateSync();
      assert.strictEqual(err, undefined);
      assert.strictEqual(item.status, 'Pending');
    });

    it('should require item title', () => {
      const item = new Item({
        category: 'Accessories',
        description: 'Description',
        location: 'Campus',
        date: new Date(),
        type: 'lost',
        reportedBy: new mongoose.Types.ObjectId(),
      });
      const err = item.validateSync();
      assert.ok(err.errors.title);
    });

    it('should require item category', () => {
      const item = new Item({
        title: 'Keys',
        description: 'Description',
        location: 'Campus',
        date: new Date(),
        type: 'lost',
        reportedBy: new mongoose.Types.ObjectId(),
      });
      const err = item.validateSync();
      assert.ok(err.errors.category);
    });

    it('should require item description', () => {
      const item = new Item({
        title: 'Keys',
        category: 'Keys',
        location: 'Campus',
        date: new Date(),
        type: 'lost',
        reportedBy: new mongoose.Types.ObjectId(),
      });
      const err = item.validateSync();
      assert.ok(err.errors.description);
    });

    it('should require item location', () => {
      const item = new Item({
        title: 'Keys',
        category: 'Keys',
        description: 'Set of 3 keys',
        date: new Date(),
        type: 'lost',
        reportedBy: new mongoose.Types.ObjectId(),
      });
      const err = item.validateSync();
      assert.ok(err.errors.location);
    });

    it('should only allow "lost" or "found" as item type', () => {
      const item = new Item({
        title: 'Keys',
        category: 'Keys',
        description: 'Set of keys',
        location: 'Library',
        date: new Date(),
        type: 'misplaced', // invalid enum
        reportedBy: new mongoose.Types.ObjectId(),
      });
      const err = item.validateSync();
      assert.ok(err.errors.type);
    });
  });

  describe('User Model', () => {
    it('should validate a complete and valid user', () => {
      const user = new User({
        name: 'Ajinkya Student',
        email: '24107068@apsit.edu.in',
        password: 'SecurePassword123',
        department: 'Information Technology',
        studentId: '24107068',
      });
      const err = user.validateSync();
      assert.strictEqual(err, undefined);
      assert.strictEqual(user.role, 'user');
      assert.strictEqual(user.status, 'pending');
      assert.strictEqual(user.approved, false);
    });

    it('should require user name', () => {
      const user = new User({
        email: '24107068@apsit.edu.in',
        password: 'Password123',
      });
      const err = user.validateSync();
      assert.ok(err.errors.name);
    });

    it('should require user email', () => {
      const user = new User({
        name: 'Student Name',
        password: 'Password123',
      });
      const err = user.validateSync();
      assert.ok(err.errors.email);
    });

    it('should enforce minimum password length of 6 characters', () => {
      const user = new User({
        name: 'Student Name',
        email: '24107068@apsit.edu.in',
        password: '123', // too short
      });
      const err = user.validateSync();
      assert.ok(err.errors.password);
    });

    it('should restrict user role to "user" or "admin"', () => {
      const user = new User({
        name: 'Student Name',
        email: '24107068@apsit.edu.in',
        password: 'Password123',
        role: 'superman', // invalid role
      });
      const err = user.validateSync();
      assert.ok(err.errors.role);
    });

    it('should restrict status to "pending", "approved", or "rejected"', () => {
      const user = new User({
        name: 'Student Name',
        email: '24107068@apsit.edu.in',
        password: 'Password123',
        status: 'suspended', // invalid status
      });
      const err = user.validateSync();
      assert.ok(err.errors.status);
    });
  });

  describe('Category Model', () => {
    it('should validate valid category', () => {
      const cat = new Category({
        name: 'Electronics',
        description: 'Laptops, phones, chargers',
        icon: 'FiSmartphone',
      });
      const err = cat.validateSync();
      assert.strictEqual(err, undefined);
    });

    it('should require category name', () => {
      const cat = new Category({});
      const err = cat.validateSync();
      assert.ok(err.errors.name);
    });
  });

  describe('Otp Model', () => {
    it('should validate valid OTP record', () => {
      const otp = new Otp({
        email: '24107068@apsit.edu.in',
        otp: '123456',
        purpose: 'report_lost_item',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      const err = otp.validateSync();
      assert.strictEqual(err, undefined);
    });

    it('should require email and otp in OTP model', () => {
      const otp = new Otp({});
      const err = otp.validateSync();
      assert.ok(err.errors.email);
      assert.ok(err.errors.otp);
    });
  });

  describe('Claim Model', () => {
    it('should validate valid claim', () => {
      const claim = new Claim({
        item: new mongoose.Types.ObjectId(),
        fullName: 'Ajinkya Test',
        email: '24107068@apsit.edu.in',
        phone: '9876543210',
        additionalDetails: 'Has a distinctive sticker on the back',
      });
      const err = claim.validateSync();
      assert.strictEqual(err, undefined);
      assert.strictEqual(claim.status, 'pending');
    });

    it('should require fullName, email, and phone for a claim', () => {
      const claim = new Claim({});
      const err = claim.validateSync();
      assert.ok(err.errors.fullName);
      assert.ok(err.errors.email);
      assert.ok(err.errors.phone);
    });
  });
});
