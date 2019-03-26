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

import Logger from 'utils/Logger';

import BasePanelViewModel from './BasePanelViewModel';

import '../../components/panel/userActions';
import '../../components/panel/enrichedFields';
import '../../components/panel/userDetails';

export default class GroupParticipantUserViewModel extends BasePanelViewModel {
  constructor(params) {
    super(params);

    const {mainViewModel, repositories} = params;

    this.userRepository = repositories.user;
    this.actionsViewModel = mainViewModel.actions;
    this.teamRepository = repositories.team;

    this.logger = Logger('GroupParticipantUserViewModel');

    this.selectedParticipant = ko.observable(undefined);

    this.showActionDevices = ko.pureComputed(() => !this.selectedParticipant().is_me);
  }

  getElementId() {
    return 'group-participant-user';
  }

  getEntityId() {
    return this.selectedParticipant().id;
  }

  clickOnDevices() {
    this.navigateTo(z.viewModel.PanelViewModel.STATE.PARTICIPANT_DEVICES, {entity: this.selectedParticipant()});
  }

  initView({entity: user}) {
    const userEntity = user;
    this.selectedParticipant(userEntity);

    if (userEntity.isTemporaryGuest()) {
      userEntity.checkGuestExpiration();
    }
  }
}
