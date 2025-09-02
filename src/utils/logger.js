// ===== IMPORTS & DEPENDENCIES =====
const chalk = require('chalk');

// ===== LOGGER UTILITY =====
class Logger {
  constructor() {
    this.colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      header: chalk.magenta,
      cyan: chalk.cyan,
    };
  }

  info(message) {
    console.log(`${this.colors.info('[INFO]')} ${message}`);
  }

  success(message) {
    console.log(`${this.colors.success('[SUCCESS]')} ${message}`);
  }

  warning(message) {
    console.log(`${this.colors.warning('[WARNING]')} ${message}`);
  }

  error(message) {
    console.error(`${this.colors.error('[ERROR]')} ${message}`);
  }

  header(message) {
    console.log(`\n${this.colors.header(`=== ${message} ===`)}`);
  }

  plain(message) {
    console.log(message);
  }

  // Utility for formatted output
  table(data, options = {}) {
    const Table = require('cli-table3');
    const table = new Table({
      head: options.head || [],
      style: {
        head: ['cyan'],
        border: ['grey'],
        compact: false,
      },
      colWidths: options.colWidths || [],
    });

    if (Array.isArray(data)) {
      data.forEach(row => table.push(row));
    }

    console.log(table.toString());
  }
}

module.exports = new Logger();
