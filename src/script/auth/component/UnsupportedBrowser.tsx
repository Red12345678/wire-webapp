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

import {COLOR, Container, ContainerXS, H1, H2, H3, Loading, Logo, Text} from '@wireapp/react-ui-kit';
import * as React from 'react';
import {FormattedHTMLMessage, FormattedMessage, InjectedIntlProps, injectIntl} from 'react-intl';
import {connect} from 'react-redux';
import {unsupportedJoinStrings, unsupportedStrings} from '../../strings';
import {Config} from '../config';
import {RootState, ThunkDispatch} from '../module/reducer';
import * as RuntimeSelector from '../module/selector/RuntimeSelector';
import {isMobileOs} from '../Runtime';
import {WirelessContainer} from './WirelessContainer';

interface UnsupportedProps extends React.HTMLProps<HTMLDivElement> {
  headline: FormattedMessage.MessageDescriptor;
  subhead: FormattedMessage.MessageDescriptor;
}

const UnsupportedMessage: React.SFC<UnsupportedProps> = ({headline, subhead}) => (
  <ContainerXS verticalCenter centerText>
    <Logo height={20} />
    <H1 center style={{marginBottom: '48px', marginTop: '24px'}}>
      <FormattedMessage {...headline} values={{brandName: Config.BRAND_NAME}} />
    </H1>
    <Text center>
      <FormattedMessage {...subhead} values={{brandName: Config.BRAND_NAME}} />
    </Text>
  </ContainerXS>
);

export interface Props extends React.HTMLProps<HTMLDivElement> {
  isTemporaryGuest?: boolean;
}

interface ConnectedProps {
  hasCookieSupport: boolean;
  hasIndexedDbSupport: boolean;
  isCheckingSupport: boolean;
  isSupportedBrowser: boolean;
}

interface DispatchProps {}

type CombinedProps = Props & DispatchProps & ConnectedProps & InjectedIntlProps;

export const _UnsupportedBrowser = ({
  children,
  hasCookieSupport,
  hasIndexedDbSupport,
  isCheckingSupport,
  isSupportedBrowser,
  isTemporaryGuest,
}: CombinedProps) => {
  if (!isSupportedBrowser) {
    return (
      <WirelessContainer>
        <Container verticalCenter>
          <H2 style={{fontWeight: 500, marginBottom: '10px', marginTop: '0'}} color={COLOR.GRAY}>
            <FormattedHTMLMessage
              {...(isTemporaryGuest
                ? unsupportedJoinStrings.unsupportedJoinHeadline
                : unsupportedStrings.headlineBrowser)}
              values={{brandName: Config.BRAND_NAME}}
            />
          </H2>
          {isTemporaryGuest && isMobileOs() ? (
            <H3 style={{marginBottom: '10px'}}>
              <FormattedHTMLMessage {...unsupportedJoinStrings.unsupportedJoinMobileSubhead} />
            </H3>
          ) : (
            <H3 style={{marginBottom: '10px'}}>
              <FormattedHTMLMessage {...unsupportedStrings.subheadBrowser} />
            </H3>
          )}
        </Container>
      </WirelessContainer>
    );
  }

  if (isCheckingSupport) {
    return (
      <ContainerXS centerText verticalCenter style={{justifyContent: 'center'}}>
        <Loading />
      </ContainerXS>
    );
  }

  if (!hasCookieSupport) {
    return (
      <UnsupportedMessage headline={unsupportedStrings.headlineCookies} subhead={unsupportedStrings.subheadCookies} />
    );
  }

  if (!hasIndexedDbSupport) {
    return (
      <UnsupportedMessage
        headline={unsupportedStrings.headlineIndexedDb}
        subhead={unsupportedStrings.subheadIndexedDb}
      />
    );
  }

  return <>{children}</>;
};

export const UnsupportedBrowser = injectIntl(
  connect(
    (state: RootState) => ({
      hasCookieSupport: RuntimeSelector.hasCookieSupport(state),
      hasIndexedDbSupport: RuntimeSelector.hasIndexedDbSupport(state),
      isCheckingSupport: RuntimeSelector.isChecking(state),
      isSupportedBrowser: RuntimeSelector.isSupportedBrowser(state),
    }),
    (dispatch: ThunkDispatch): DispatchProps => ({})
  )(_UnsupportedBrowser)
);
