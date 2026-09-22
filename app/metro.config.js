// Shared JSON (country data, tier limits) lives outside app/ – let Metro see it.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../data'), path.resolve(__dirname, '../config')];

module.exports = config;
