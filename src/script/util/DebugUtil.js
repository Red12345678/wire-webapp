/*
 * Wire
 * Copyright (C) 2018 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

import $ from 'jquery';
import sodium from 'libsodium-wrappers-sumo';
import Dexie from 'dexie';

import {getLogger} from 'Util/Logger';

import {checkVersion} from '../lifecycle/newVersionHandler';
import {downloadFile} from './util';

import {BackendEvent} from '../event/Backend';
import {StorageSchemata} from '../storage/StorageSchemata';
import {EventRepository} from '../event/EventRepository';

function downloadText(text, filename = 'default.txt') {
  const url = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
  return downloadFile(url, filename);
}

export class DebugUtil {
  constructor(repositories) {
    const {calling, client, connection, conversation, cryptography, event, user, storage} = repositories;

    this.callingRepository = calling;
    this.clientRepository = client;
    this.conversationRepository = conversation;
    this.connectionRepository = connection;
    this.cryptographyRepository = cryptography;
    this.eventRepository = event;
    this.storageRepository = storage;
    this.userRepository = user;
    this.$ = $;
    this.sodium = sodium;
    this.Dexie = Dexie;

    this.logger = getLogger('DebugUtil');
  }

  blockAllConnections() {
    const blockUsers = this.userRepository.users().map(userEntity => this.connectionRepository.blockUser(userEntity));
    return Promise.all(blockUsers);
  }

  breakSession(userId, clientId) {
    const sessionId = `${userId}@${clientId}`;
    const cryptobox = this.cryptographyRepository.cryptobox;
    return cryptobox
      .session_load(sessionId)
      .then(cryptoboxSession => {
        cryptoboxSession.session.session_states = {};

        const record = {
          created: Date.now(),
          id: sessionId,
          serialised: cryptoboxSession.session.serialise(),
          version: 'broken_by_qa',
        };

        cryptobox.cachedSessions.set(sessionId, cryptoboxSession);

        const sessionStoreName = StorageSchemata.OBJECT_STORE.SESSIONS;
        return this.storageRepository.storageService.update(sessionStoreName, sessionId, record);
      })
      .then(() => this.logger.log(`Corrupted Session ID '${sessionId}'`));
  }

  triggerVersionCheck(baseVersion) {
    return checkVersion(baseVersion);
  }

  /**
   * Will allow the webapp to generate fake link previews when sending a link in a message.
   *
   * @returns {void} - returns nothing
   */
  enableLinkPreviews() {
    /*
     * To allow the LinkPreviewRepository to generate link previews, we need to expose a fake 'openGraphAsync' method.
     * This function is normally exposed by the desktop wrapper
     */
    window.openGraphAsync = url => {
      return Promise.resolve({
        image: {
          data:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAADiUlEQVR4nO3dS67cMAwEwHeWuf8dkxOMDVDTJiVXA1pq+FF5EyDJ3+fz+XfCuUp3bzv3Wj1/3Q288bF26rV6wNJr5ICl18gBS6+RA5ZeIwcsvUbOJaxpSTxW9V5HzWkBC6xIwAIrErDAigQssCIBC6xIwAIrkgisu6VXT7Vm4l5HTnkPsIbllPcAa1hOeQ+whuWU9wBrWE55D7CG5ZT3AGtYTnmP18PqmGOnGas1wQILrGm9ggUWWGDts3SwwAILrH2WDhZYYIH1+6V35JSPp1oTrFDAOmSQaQHrkEGmBaxDBpkWsA4ZZFrAOmSQaQHr5Y+1Mn9id6e8B1hglQMWWJGABVYkYIEVCVhgRQIWWJGUYe10qguo3uuqucsBCyywpj0yWGCBBRZYJxywwAJr2iODdQHrcsoXZNpHcErAAisSsMCKBCywIgELrEjAAisSsMCKpPznWCuZ9Fgrv/k0nmq9jo8HLLDAAgusxwdN9JK8+2SvYIEVqQcWWJF6YIEVqbcVrBSCSXg65u+YI7EDsAJLBQusyFLBAiuyVLDAiiwVLLAiSwULrMhSwbr5yxQdgySG7IA1acaOOcAK1Zs0I1g3AQusbZaeqjdpRrBuAhZY2yw9VW/SjGDdBCywtll6qt6kGY+BdZfU706pt9JP4iPo6AeshoAF1uP9gLUQsMAC6+F+wFoIWGCB9XA/r4CVGqT6u4mz0svTc6SS6BWshV6eniMVsMCKBCywIgELrEjAAisSsMCKZBSsnQLWdRI1wSreA+s6YBXvgXUdsIr3wLoOWMV7YF0HrOI9sK4DVvEeWNd5xX/dW00HrGmp9gpWcalggRVZKlhgRZYKFliRpYIFVmSpYIEVWSpYC7CmJfHI1XsdH0FqjkRNsIr3wAILLLCuAxZYkYAFViRggRUJWC+A1bH0ab0+jWenAxZYYE3rFSywwAKrVnPaY1XTDQKsAb2CBRZYYNVq7vSQiV5XZkzsByywIvsBC6zIfsACK7IfsMCK7AcssCL7AQusyH7AAiuyn9fDSs3YUXPSRwBWaMaOmmCBFakJFliRmmCBFakJFliRmmCBFal5BKyO7PQRJPpJ7Gb17reABRZYYP1+N6t3vwUssMAC6/e7Wb37LWCBBRZYv9/N6t1vecU/btvx8UyCvNJr9R5YoYA1AAVYYI09icWtBKwBKMACa+xJLG4lYA1AAdZ5sP4Df5GjbWdSI2IAAAAASUVORK5CYII=',
        },
        title: 'A link to the past',
        url,
      });
    };
  }

  getLastMessagesFromDatabase(amount = 10, conversationId = this.conversationRepository.active_conversation().id) {
    return this.storageRepository.storageService.db.events.toArray(records => {
      const messages = records.filter(events => events.conversation === conversationId);
      return messages.slice(amount * -1).reverse();
    });
  }

  haveISentThisMessageToMyOtherClients(
    messageId,
    conversationId = this.conversationRepository.active_conversation().id
  ) {
    let recipients = [];

    const clientId = this.clientRepository.currentClient().id;
    const userId = this.userRepository.self().id;

    const isOTRMessage = notification => notification.type === BackendEvent.CONVERSATION.OTR_MESSAGE_ADD;
    const isInCurrentConversation = notification => notification.conversation === conversationId;
    const wasSentByOurCurrentClient = notification =>
      notification.from === userId && (notification.data && notification.data.sender === clientId);
    const hasExpectedTimestamp = (notification, dateTime) => notification.time === dateTime.toISOString();

    return this.conversationRepository
      .get_conversation_by_id(conversationId)
      .then(conversation => {
        return this.conversationRepository.get_message_in_conversation_by_id(conversation, messageId);
      })
      .then(message => {
        return this.eventRepository.notificationService
          .getNotifications(undefined, undefined, EventRepository.CONFIG.NOTIFICATION_BATCHES.MAX)
          .then(({notifications}) => ({
            message,
            notifications,
          }));
      })
      .then(({message, notifications}) => {
        const dateTime = new Date(message.timestamp());
        return notifications
          .reduce((accumulator, notification) => accumulator.concat(notification.payload), [])
          .filter(event => {
            return (
              isOTRMessage(event) &&
              isInCurrentConversation(event) &&
              wasSentByOurCurrentClient(event) &&
              hasExpectedTimestamp(event, dateTime)
            );
          });
      })
      .then(filteredEvents => {
        recipients = filteredEvents.map(event => event.data.recipient);
        return this.clientRepository.getClientsForSelf();
      })
      .then(selfClients => {
        const selfClientIds = selfClients.map(client => client.id);
        const missingClients = selfClientIds.filter(id => recipients.includes(id));
        const logMessage = missingClients.length
          ? `Message was sent to all other "${selfClients.length}" clients.`
          : `Message was NOT sent to the following own clients: ${missingClients.join(',')}`;
        this.logger.info(logMessage);
      })
      .catch(error => this.logger.info(`Message was not sent to other clients. Reason: ${error.message}`, error));
  }

  getEventInfo(event) {
    const debugInformation = {event};

    return this.conversationRepository
      .get_conversation_by_id(event.conversation)
      .then(conversation_et => {
        debugInformation.conversation = conversation_et;
        return this.userRepository.get_user_by_id(event.from);
      })
      .then(user_et => {
        debugInformation.user = user_et;
        const logMessage = `Hey ${this.userRepository.self().name()}, this is for you:`;
        this.logger.warn(logMessage, debugInformation);
        this.logger.warn(`Conversation: ${debugInformation.conversation.name()}`, debugInformation.conversation);
        this.logger.warn(`From: ${debugInformation.user.name()}`, debugInformation.user);
        return debugInformation;
      });
  }

  exportCryptobox() {
    const clientId = this.clientRepository.currentClient().id;
    const userId = this.userRepository.self().id;
    const fileName = `cryptobox-${userId}-${clientId}.json`;

    this.cryptographyRepository.cryptobox
      .serialize()
      .then(cryptobox => downloadText(JSON.stringify(cryptobox), fileName));
  }

  getNotificationFromStream(notificationId, notificationIdSince) {
    const clientId = this.clientRepository.currentClient().id;

    const _gotNotifications = ({hasMore, notifications}) => {
      const matchingNotifications = notifications.filter(notification => notification.id === notificationId);
      if (matchingNotifications.length) {
        return matchingNotifications[0];
      }

      if (hasMore) {
        const lastNotification = notifications[notifications.length - 1];
        return this.getNotificationFromStream(notificationId, lastNotification.id);
      }
      this.logger.log(`Notification '${notificationId}' was not found in encrypted notification stream`);
    };

    return wire.app.service.notification.getNotifications(clientId, notificationIdSince, 10000).then(_gotNotifications);
  }

  getNotificationsFromStream(remoteUserId, remoteClientId, matchingNotifications = [], notificationIdSince) {
    const localClientId = this.clientRepository.currentClient().id;
    const localUserId = this.userRepository.self().id;

    const _gotNotifications = ({hasMore, notifications}) => {
      const additionalNotifications = !remoteUserId
        ? notifications
        : notifications.filter(notification => {
            const payload = notification.payload;
            for (const {data, from} of payload) {
              if (data && [localUserId, remoteUserId].includes(from)) {
                const {sender, recipient} = data;
                const incoming_event = sender === remoteClientId && recipient === localClientId;
                const outgoing_event = sender === localClientId && recipient === remoteClientId;
                return incoming_event || outgoing_event;
              }
            }
            return false;
          });

      matchingNotifications = matchingNotifications.concat(additionalNotifications);

      if (hasMore) {
        const lastNotification = notifications[notifications.length - 1];
        return this.getNotificationsFromStream(
          remoteUserId,
          remoteClientId,
          matchingNotifications,
          lastNotification.id
        );
      }

      const logMessage = remoteUserId
        ? `Found '${matchingNotifications.length}' notifications between '${localClientId}' and '${remoteClientId}'`
        : `Found '${matchingNotifications.length}' notifications`;

      this.logger.log(logMessage, matchingNotifications);

      return matchingNotifications;
    };

    const clientScope = remoteUserId === localUserId ? undefined : localClientId;
    return wire.app.service.notification
      .getNotifications(clientScope, notificationIdSince, 10000)
      .then(_gotNotifications);
  }

  getObjectsForDecryptionErrors(sessionId, notificationId) {
    return Promise.all([
      this.getNotificationFromStream(notificationId.toLowerCase()),
      this.getSerialisedIdentity(),
      this.getSerialisedSession(sessionId.toLowerCase()),
    ]).then(resolveArray => {
      return JSON.stringify({
        identity: resolveArray[1],
        notification: resolveArray[0],
        session: resolveArray[2],
      });
    });
  }

  getInfoForClientDecryptionErrors(remoteUserId, remoteClientId) {
    return Promise.all([
      this.getNotificationsFromStream(remoteUserId, remoteClientId),
      this.getSerialisedIdentity(),
      this.getSerialisedSession(`${remoteUserId}@${remoteClientId}`),
    ]).then(resolveArray => {
      return JSON.stringify({
        identity: resolveArray[1],
        notifications: resolveArray[0],
        session: resolveArray[2],
      });
    });
  }

  /**
   * Print call log to console.
   * @returns {undefined} No return value
   */
  logCallMessages() {
    this.callingRepository.printLog();
  }

  reprocessNotificationStream(conversationId = this.conversationRepository.active_conversation().id) {
    const clientId = this.clientRepository.currentClient().id;

    return this.eventRepository.notificationService
      .getNotifications(clientId, undefined, EventRepository.CONFIG.NOTIFICATION_BATCHES.MAX)
      .then(({notifications}) => {
        this.logger.info(`Fetched "${notifications.length}" notifications for client "${clientId}".`, notifications);

        const isOTRMessage = notification => notification.type === BackendEvent.CONVERSATION.OTR_MESSAGE_ADD;
        const isInCurrentConversation = notification => notification.conversation === conversationId;

        return notifications
          .map(notification => notification.payload)
          .reduce((accumulator, payload) => accumulator.concat(payload))
          .filter(notification => {
            return isOTRMessage(notification) && isInCurrentConversation(notification);
          });
      })
      .then(events => {
        this.logger.info(`Reprocessing "${events.length}" OTR messages...`);
        events.forEach(event => this.eventRepository.processEvent(event, EventRepository.SOURCE.STREAM));
      });
  }
}
