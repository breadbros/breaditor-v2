import * as Watchman from "fb-watchman";


import { debug } from "shared/debug";

// Initialize Watchman client
const client = new Watchman.Client();

let _isInitialized = false;

let _watching = new Set<string>([]);

export function initialize() {
  client.capabilityCheck({ optional: [], required: [] }, (error, response) => {
    if (error) {
      console.error("Error connecting to Watchman:", error);
      throw error;
    }

    _isInitialized = true;

    debug.watchman && console.log(`watchman init: ${response}`);
  });
}

export function watch(watchPath: string) {
  if (!_isInitialized) {
    throw new Error("Watchman Client not initialized");
  }

  if (_watching.has(watchPath)) {
    throw new Error(`already watching '${watchPath}'`);
  }

  client.command(['watch-project', dir_of_interest],
  function (error, resp) {
    if (error) {
      console.error('Error initiating watch:', error);
      return;
    }

    // It is considered to be best practice to show any 'warning' or
    // 'error' information to the user, as it may suggest steps
    // for remediation
    if ('warning' in resp) {
      console.log('warning: ', resp.warning);
    }

    // `watch-project` can consolidate the watch for your
    // dir_of_interest with another watch at a higher level in the
    // tree, so it is very important to record the `relative_path`
    // returned in resp

    console.log('watch established on ', resp.watch,
                ' relative_path', resp.relative_path);
  });
}
