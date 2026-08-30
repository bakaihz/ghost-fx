const Optimizer = require('./requests/Optimizer');
const Browser = require('./browser/Browser');
const ProjectManager = require('./fs/ProjectManager');
const Ghost = require('./core/Ghost');

module.exports = {
  Ghost,
  RequestOptimizer: Optimizer,
  Browser,
  ProjectManager
};
