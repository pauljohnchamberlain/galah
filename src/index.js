import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { postCommand } from './commands/post.js';
import { threadCommand } from './commands/thread.js';
import { timelineCommand } from './commands/timeline.js';
import { viewCommand } from './commands/view.js';
import { deleteCommand } from './commands/delete.js';
import { meCommand } from './commands/me.js';
import { logoutCommand } from './commands/logout.js';
import { searchCommand } from './commands/search.js';
import { scheduleCommand } from './commands/schedule.js';

const program = new Command();

program
  .name('galah')
  .version('0.1.0')
  .description('A beautiful CLI for Twitter/X');

program.addCommand(authCommand);
program.addCommand(postCommand);
program.addCommand(threadCommand);
program.addCommand(timelineCommand);
program.addCommand(viewCommand);
program.addCommand(deleteCommand);
program.addCommand(meCommand);
program.addCommand(logoutCommand);
program.addCommand(searchCommand);
program.addCommand(scheduleCommand);

export function run(argv) {
  program.parse(argv);
}
