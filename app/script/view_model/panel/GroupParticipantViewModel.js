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

'use strict';

window.z = window.z || {};
window.z.viewModel = z.viewModel || {};
window.z.viewModel.panel = z.viewModel.panel || {};

z.viewModel.panel.GroupParticipantViewModel = class GroupParticipantViewModel {
  constructor(mainViewModel, panelViewModel, repositories) {
    this.mainViewModel = mainViewModel;
    this.panelViewModel = panelViewModel;
    this.conversationRepository = repositories.conversation;
    this.integrationRepository = repositories.integration;
    this.userRepository = repositories.user;
    this.logger = new z.util.Logger('z.viewModel.panel.GroupParticipantViewModel', z.config.LOGGER.OPTIONS);

    this.actionsViewModel = this.mainViewModel.actions;
    this.conversationEntity = this.conversationRepository.active_conversation;

    this.availabilityLabel = ko.pureComputed(() => {
      if (this.isVisible() && this.selectedParticipant() && !this.selectedParticipant().isBot) {
        const availabilitySetToNone = this.selectedParticipant().availability() === z.user.AvailabilityType.NONE;
        if (!availabilitySetToNone) {
          return z.user.AvailabilityMapper.nameFromType(this.selectedParticipant().availability());
        }
      }
    });

    this.selectedParticipant = ko.observable(undefined);

    this.isVisible = ko.pureComputed(() => this.panelViewModel.groupParticipantVisible() && this.selectedParticipant());

    this.selectedIsInConversation = ko.pureComputed(() => {
      if (this.isVisible()) {
        const participatingUserIds = this.conversationEntity().participating_user_ids();
        return participatingUserIds.some(id => this.selectedParticipant().id === id);
      }
    });
    this.selfIsActiveMember = ko.pureComputed(() => {
      if (this.isVisible()) {
        return !this.conversationEntity().removed_from_conversation() && !this.conversationEntity().is_guest();
      }
    });

    this.showActionsIncomingRequest = ko.pureComputed(() => this.selectedParticipant().is_incoming_request());
    this.showActionsOutgoingRequest = ko.pureComputed(() => this.selectedParticipant().is_outgoing_request());

    this.showActionBlock = ko.pureComputed(() => {
      return this.selectedParticipant().is_connected() || this.selectedParticipant().is_request();
    });
    this.showActionDevices = ko.pureComputed(() => {
      return this.selectedParticipant().is_connected() || this.selectedParticipant().is_team_member();
    });
    this.showActionOpenConversation = ko.pureComputed(() => {
      return this.selectedParticipant().is_connected() || this.selectedParticipant().is_team_member();
    });
    this.showActionRemove = ko.pureComputed(() => this.selfIsActiveMember() && this.selectedIsInConversation());
    this.showActionSelfProfile = ko.pureComputed(() => this.selectedParticipant().is_me);
    this.showActionSendRequest = ko.pureComputed(() => {
      const isNotConnectedUser = this.selectedParticipant().is_canceled() || this.selectedParticipant().is_unknown();
      const canConnect = !this.selectedParticipant().is_team_member() && !this.selectedParticipant().isTemporaryGuest();
      return isNotConnectedUser && canConnect;
    });
    this.showActionLeave = ko.pureComputed(() => {
      return this.selectedParticipant().is_me && !this.conversationEntity.removed_from_conversation();
    });
    this.showActionUnblock = ko.pureComputed(() => this.selectedParticipant().is_blocked());
    this.showGroupParticipant = this.showGroupParticipant.bind(this);
  }

  clickOnBack() {
    this.panelViewModel.switchState(z.viewModel.PanelViewModel.STATE.CONVERSATION_DETAILS);
    this.selectedParticipant(undefined);
  }

  clickOnClose() {
    this.panelViewModel.closePanel().then(() => this.selectedParticipant(undefined));
  }

  clickOnDevices() {
    this.panelViewModel.showParticipantDevices(this.selectedParticipant());
  }

  clickOnShowProfile() {
    amplify.publish(z.event.WebApp.PREFERENCES.MANAGE_ACCOUNT);
  }

  clickOnOpenConversation() {
    this.actionsViewModel.open1to1Conversation(this.selectedParticipant());
  }

  clickToAcceptRequest() {
    this.actionsViewModel.acceptConnectionRequest(this.selectedParticipant(), true);
  }

  clickToIgnoreRequest() {
    this.actionsViewModel.ignoreConnectionRequest(this.selectedParticipant());
  }

  clickToBlock() {
    const nextConversationEntity = this.conversationRepository.get_next_conversation(this.conversationEntity());
    this.actionsViewModel.blockUser(this.selectedParticipant(), nextConversationEntity);
  }

  clickToLeave() {
    this.actionsViewModel.leaveConversation(this.conversationEntity());
  }

  clickToRemove() {
    this.actionsViewModel.removeFromConversation(this.conversationEntity(), this.selectedParticipant());
  }

  clickToSendRequest() {
    this.actionsViewModel.sendConnectionRequest(this.selectedParticipant());
  }

  clickToUnblock() {
    this.actionsViewModel.unblockUser(this.selectedParticipant(), false);
  }

  showGroupParticipant(userEntity) {
    this.selectedParticipant(undefined);
    if (userEntity.isBot) {
      return this._showService(userEntity);
    }
    this.selectedParticipant(userEntity);
  }

  _showService(userEntity) {
    const {providerId, serviceId} = userEntity;

    this.integrationRepository
      .getServiceById(providerId, serviceId)
      .then(serviceEntity => {
        serviceEntity.isBot = true;
        this.selectedParticipant(serviceEntity);
        return this.integrationRepository.getProviderById(providerId);
      })
      .then(providerEntity => this.selectedParticipant().providerName(providerEntity.name));
  }
};
