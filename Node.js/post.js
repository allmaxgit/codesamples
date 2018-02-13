import admZip from 'adm-zip';

import { Controller } from 'lib/routeGenerator';
import sequelize from 'lib/sequelize';
import { error } from 'lib/logger';
import FbHook from 'database/fbHook/FbHook';
import findAllFbHooks from 'database/fbHook/findAllFbHooks';
import createFbHook from 'database/fbHook/createFbHook';
import IntentManager from 'apiai/intents/IntentManager';

export default {
  parameters: {
    arch: {
      required: true
    }
  },
  settings: {
  },
  method: async (
    arch: {
      name: string,
      data: Buffer,
      encoding: string,
      mimetype: string,
      mv: (path: string, callback: (error: Error) => void) => void
    }
  ): Promise<boolean> => {
    const fbHooksZip = new admZip(arch.data);
    const fbHooksEntries = fbHooksZip.getEntries();
    const fbHooksInput = new Map();

    const fbHooksArray = await findAllFbHooks();
    const existingFbHooks = new Map();
    for (const hook of fbHooksArray) {
      existingFbHooks.set(hook.payload, hook);
    }

    const executives = [];

    while (fbHooksEntries.length) {
      const entry = fbHooksEntries.pop();
      if (entry.isDirectory) continue;
      const nameSearch = entry.name.match(/^([\w-]+)\.json$/);
      if (!nameSearch) continue;
      const payload = nameSearch[1];
      const duplicatedPayload = fbHooksInput.get(payload);
      if (duplicatedPayload) {
        const err = new Error(`Duplication of payload name '${entry.name}': ` +
        `fbHook ${entry.entryName} has the same name as ${duplicatedPayload.entryName}`);
        error(err.message, err);
        throw {
          code: 400,
          message: err.message
        };
      }
      const responseString = fbHooksZip.readAsText(entry);
      let response;
      try {
        response = JSON.parse(responseString);
      } catch (e) {
        e.message = `${entry.entryName}: ` + e.message;
        error(e.message, e);
        throw {
          code: 400,
          message: e.message
        };
      }
      fbHooksInput.set(payload, {
        payload,
        responseString,
        response,
        entryName: entry.entryName
      });
    }

    const intentManager = new IntentManager();
    for (const hook of fbHooksInput.values()) {
      const existingHook = existingFbHooks.get(hook.payload);
      if (existingHook) {
        if (existingHook.response !== hook.responseString) {
          executives.push(importHookWithIntent(
            intentManager,
            hook,
            existingHook
          ));
        }
      } else {
        executives.push(importHookWithIntent(
          intentManager,
          hook,
        ));
      }
    }

    for (const executive of executives) {
      await executive.execute();
    }
    return true;
  }
} as Controller;


function importHookWithIntent(
  intentManager: IntentManager,
  hookData: {
    payload: string,
    response: any,
    responseString: string
  },
  hookObject?: FbHook,
) {
  return {
    execute: async () => {
      const transaction = await sequelize.transaction();
      if (hookObject) { // just update and save it
        hookObject.response = hookData.responseString;
        try {
          await hookObject.save({ transaction });
          await intentManager.createOrUpdate(
            hookObject.payload + '', hookObject.response
          );

          await transaction.commit();
        } catch (err) {
          await transaction.rollback();
          const message = `While updating fbHook id=${hookObject.id} payload='${hookObject.payload}'`;
          err.message = `${message}: ${err.message}`;
          error(err.message, err);
          throw {
            code: 400,
            message
          };
        }
      } else { // create new
        try {
          await createFbHook(
            hookData.payload,
            hookData.responseString,
            transaction,
          );
          await intentManager.createOrUpdate(
            hookData.payload + '', hookData.response
          );
          await transaction.commit();
        } catch (err) {
          await transaction.rollback();
          const message = `While creating fbHook payload='${hookData.payload}'`;
          err.message = `${message}: ${err.message}`;
          throw {
            code: 400,
            message
          };
        }
      }
    }
  };
}
