import apiaiDeveloper from './apiaiDeveloper';
import { error } from '../../../lib/logger';

type buttonType = {
  title: string,
} & ({
  type: 'web_url',
  url: string,
} | {
  type: 'postback',
  payload: string
});

type facebookMessageQuickReply = {
  text: string,
  quick_replies?: {
    content_type: 'text',
    title: string,
    payload: string,
  }[]
};

type facebookMessageAttachment = {
  attachment: {
    type: string,
    payload: {
      url?: string,
      template_type?: string,
      text?: string,
      buttons: buttonType[]
      elements?: {
        title: string,
        subtitle?: string,
        image_url?: string,
        buttons?: buttonType[]
      }[]
    }
  }
};

type facebookMessage = facebookMessageQuickReply | facebookMessageAttachment;

type intentType = {
  id: string,
  name: string,
  contextIn: string[]
};

export default class IntentManager {
  private intents: intentType[];

  public async createOrUpdate(
    payload: string, response: any
  ): Promise<any> {
    if (!this.intents) {
      this.intents = JSON.parse(
        await apiaiDeveloper.intents.getIntents()
      );
    }
    let responseObj: facebookMessage[];
    if (typeof response === 'string') {
      responseObj = JSON.parse(response);
    } else {
      responseObj = response;
    }
    let buttons: any[] = [];
    for (const singleResponse of responseObj) {
      if (singleResponse.quick_replies) {
        buttons = singleResponse.quick_replies;
      }
      if (singleResponse.attachment) {
        if (singleResponse.attachment.payload) {
          if (singleResponse.attachment.payload.buttons) {
            buttons = singleResponse.attachment.payload.buttons;
          } else if (singleResponse.attachment.payload.elements) {
            if (singleResponse.attachment.payload.elements[0].buttons) {
              buttons = singleResponse.attachment.payload.elements[0].buttons;
            }
          }
        }
      }
    }

    const intentNamePattern = new RegExp(`^${payload}_\\d+$`, 'i');
    const targetIntents = this.intents.filter(
      intent => intentNamePattern.test(intent.name)
    );
    const targetIntentsExtended = (await Promise.all(targetIntents.map(
      intent => apiaiDeveloper.intents.getIntentById(intent.id)
    ))).map(
      (intent) => {
        const intentObj = JSON.parse(intent);
        return {
          intent: intentObj,
          index: +intentObj.name.slice(payload.length + 1)
        };
      }
    ).sort((a, b) => a.index - b.index);


    const actions: {
      type: 'create' | 'update' | 'delete',
      intent: { id?: string },
      buttonTitle?: string,
      userSays: string[],
      buttonPayload?: string,
      buttonIndex?: number
    }[] = [];

    buttons.forEach((button, buttonIndex) => {
      const xIntent = targetIntentsExtended[0];
      if (xIntent) {
        if (xIntent.index === buttonIndex + 1) {
          targetIntentsExtended.shift();
          actions.push({
            type: 'update',
            intent: xIntent.intent,
            buttonTitle: button.title,
            userSays: button.user_says,
            buttonPayload: button.payload,
            buttonIndex
          });
        } else {
          actions.push({
            type: 'create',
            intent: {},
            buttonTitle: button.title,
            userSays: button.user_says,
            buttonPayload: button.payload,
            buttonIndex
          });
        }
      } else {
        actions.push({
          type: 'create',
          intent: {},
          buttonTitle: button.title,
          userSays: button.user_says,
          buttonPayload: button.payload,
          buttonIndex
        });
      }
    });

    while (targetIntentsExtended.length) {
      actions.push({
        type: 'delete',
        intent: targetIntentsExtended.shift().intent,
        userSays: []
      });
    }

    const actionPromises = actions.map((action) => {
      let userSays = [];
      if (!isNaN(action.buttonIndex)) {
        if (action.buttonTitle) {
          userSays.push(action.buttonTitle);
        }
        if (action.userSays) {
          userSays = userSays.concat(action.userSays);
        }
      }
      switch (action.type) {
        case 'create':
          return () => apiaiDeveloper.intents.postIntent(
            {
              name: `${payload}_${action.buttonIndex + 1}`,
              auto: true,
              contexts: [payload],
              userSays: userSays.map(phrase => ({
                data: [{ text: phrase }],
                isTemplate: false,
                count: 0
              })),
              responses: [
                {
                  resetContexts: false,
                  action: 'facebook.binding',
                  affectedContexts: [],
                  parameters: [],
                  messages: [
                    {
                      type: 4,
                      payload: {
                        payload: action.buttonPayload
                      }
                    }
                  ]
                }
              ],
              priority: 500000
            }
          );

        case 'update':
          const newIntent = action.intent;
          newIntent.userSays = userSays.map(phrase => ({
            data: [{ text: phrase }],
            isTemplate: false,
            count: 0
          }));
          newIntent.responses = [];
          newIntent.responses.push({
            resetContexts: false,
            action: 'facebook.binding',
            affectedContexts: [],
            parameters: [],
            messages: [
              {
                type: 4,
                payload: {
                  payload: action.buttonPayload
                }
              }
            ]
          });
          return () => apiaiDeveloper.intents.putIntent(
            action.intent.id, newIntent
          );

        case 'delete':
          return () => apiaiDeveloper.intents.deleteIntent(action.intent.id);
      }
    });

    try {
      // MUST BE SEQUENTIAL in order to avoid intent name collisions
      for (const action of actionPromises) {
        await action();
      }
    } catch (e) {
      error('Error while updating intents in Dialogflow', e);
    }
  }
}
