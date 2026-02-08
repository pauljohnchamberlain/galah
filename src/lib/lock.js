import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LOCK_FILE = path.join(os.homedir(), ".galah-schedule.lock");

export function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const content = fs.readFileSync(LOCK_FILE, "utf-8").trim();
      const pid = Number(content);

      if (Number.isNaN(pid) || !Number.isInteger(pid)) {
        fs.unlinkSync(LOCK_FILE);
      } else {
        try {
          process.kill(pid, 0);
          return false;
        } catch {
          fs.unlinkSync(LOCK_FILE);
        }
      }
    }

    fs.writeFileSync(LOCK_FILE, String(process.pid));
    return true;
  } catch (err) {
    console.warn(`Warning: could not manage lock file: ${err.message}`);
    return true;
  }
}

export function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    // Lock file may not exist
  }
}
