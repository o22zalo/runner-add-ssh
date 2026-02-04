/**
 * Execute Module - Orchestrator
 * 
 * Coordinates the execution of SSH setup based on the plan.
 */

const linuxExecutor = require('./linux');
const windowsExecutor = require('./windows');
const commonExecutor = require('./common');
const { ProcessError } = require('../../utils/errors');
const { hasSudoAccess } = require('../../adapters/process');

/**
 * Execute the SSH setup plan
 * 
 * @param {Object} plan - Execution plan from plan()
 * @param {Object} config - Configuration
 * @param {Logger} logger - Logger instance
 * @returns {Promise<Object>} Execution result
 */
async function execute(plan, config, logger) {
  const result = {
    installed: false,
    configured: false,
    keysSetup: false,
    serviceStarted: false,
    steps: []
  };

  try {
    logger.info(`🔧 Executing plan for OS: ${plan.os}`);
    logger.info(`   Steps: ${plan.steps.join(' → ')}`);
    logger.info('');

    if (plan.os === 'linux') {
      const sudoAccess = await hasSudoAccess(logger);
      if (!sudoAccess) {
        throw new ProcessError('Insufficient privileges to configure SSH. Run as root or configure passwordless sudo.');
      }

      // Linux execution
      
      if (plan.needsInstall) {
        logger.info('📦 Installing OpenSSH Server...');
        await linuxExecutor.installSSH(config, logger);
        result.installed = true;
        result.steps.push('installed');
        logger.info('✅ Installation complete');
        logger.info('');
      }

      logger.info('⚙️  Configuring SSH Server...');
      await linuxExecutor.configureSSH(config, logger);
      result.configured = true;
      result.steps.push('configured');
      logger.info('✅ Configuration complete');
      logger.info('');

      logger.info('🔑 Setting up SSH keys...');
      await commonExecutor.setupAuthorizedKeys(config, logger);
      result.keysSetup = true;
      result.steps.push('keys-setup');
      logger.info('✅ SSH keys setup complete');
      logger.info('');

      logger.info('🚀 Starting SSH service...');
      await linuxExecutor.startSSH(config, logger);
      result.serviceStarted = true;
      result.steps.push('service-started');
      logger.info('✅ SSH service started');
      logger.info('');

    } else if (plan.os === 'windows') {
      // Windows execution
      
      if (plan.needsInstall) {
        logger.info('📦 Installing OpenSSH Server...');
        await windowsExecutor.installSSH(config, logger);
        result.installed = true;
        result.steps.push('installed');
        logger.info('✅ Installation complete');
        logger.info('');
      }

      logger.info('⚙️  Configuring SSH Server...');
      await windowsExecutor.configureSSH(config, logger);
      result.configured = true;
      result.steps.push('configured');
      logger.info('✅ Configuration complete');
      logger.info('');

      logger.info('🔑 Setting up SSH keys...');
      await commonExecutor.setupAuthorizedKeys(config, logger);
      result.keysSetup = true;
      result.steps.push('keys-setup');
      logger.info('✅ SSH keys setup complete');
      logger.info('');

      logger.info('🚀 Starting SSH service...');
      await windowsExecutor.startSSH(config, logger);
      result.serviceStarted = true;
      result.steps.push('service-started');
      logger.info('✅ SSH service started');
      logger.info('');
    }

    result.success = true;
    return result;

  } catch (error) {
    logger.error(`Execution failed: ${error.message}`);
    throw new ProcessError(`Execution failed: ${error.message}`);
  }
}

module.exports = execute;
