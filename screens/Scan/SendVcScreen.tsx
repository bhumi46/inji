import React, {useContext, useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Column, Text} from '../../components/ui';
import {Theme} from '../../components/ui/styleUtils';
import {useSendVcScreen} from './SendVcScreenController';
import {VerifyIdentityOverlay} from '../VerifyIdentityOverlay';
import {BackHandler} from 'react-native';
import {useInterpret} from '@xstate/react';
import {GlobalContext} from '../../shared/GlobalContext';
import {useFocusEffect} from '@react-navigation/native';
import {VcItemContainer} from '../../components/VC/VcItemContainer';
import {VCMetadata} from '../../shared/VCMetadata';
import {createVCItemMachine} from '../../machines/VerifiableCredential/VCItemMachine/VCItemMachine';
import {
  getImpressionEventData,
  sendImpressionEvent,
} from '../../shared/telemetry/TelemetryUtils';
import {TelemetryConstants} from '../../shared/telemetry/TelemetryConstants';
import {
  getVCsOrderedByPinStatus,
  VCItemContainerFlowType,
} from '../../shared/Utils';
import {Issuers} from '../../shared/openId4VCI/Utils';
import {FaceVerificationAlertOverlay} from './FaceVerificationAlertOverlay';
import {Error} from '../../components/ui/Error';
import {SvgImage} from '../../components/ui/svg';

export const SendVcScreen: React.FC = () => {
  const {t} = useTranslation('SendVcScreen');
  const {appService} = useContext(GlobalContext);
  const controller = useSendVcScreen();
  const shareableVcsMetadataOrderedByPinStatus = getVCsOrderedByPinStatus(
    controller.shareableVcsMetadata,
  );
  let service;

  if (shareableVcsMetadataOrderedByPinStatus?.length > 0) {
    const vcMetadata = shareableVcsMetadataOrderedByPinStatus[0];
    const firstVCMachine = useRef(
      createVCItemMachine(
        appService.getSnapshot().context.serviceRefs,
        vcMetadata,
      ),
    );

    service = useInterpret(firstVCMachine.current);
  }

  useEffect(() => {
    if (service) {
      controller.SELECT_VC_ITEM(0)(service);
    }
  }, []);
  useEffect(() => {
    sendImpressionEvent(
      getImpressionEventData(
        TelemetryConstants.FlowType.senderVcShare,
        TelemetryConstants.Screens.vcList,
      ),
    );
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => true;

      const disableBackHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => disableBackHandler.remove();
    }, []),
  );

  return (
    <React.Fragment>
      <Column fill backgroundColor={Theme.Colors.lightGreyBackgroundColor}>
        <Column>
          <Text
            margin="15 0 13 24"
            weight="bold"
            color={Theme.Colors.textValue}
            style={{position: 'relative'}}>
            {t('pleaseSelectAnId')}
          </Text>
        </Column>
        <Column scroll>
          {shareableVcsMetadataOrderedByPinStatus.map((vcMetadata, index) => (
            <VcItemContainer
              key={vcMetadata.getVcKey()}
              vcMetadata={vcMetadata}
              margin="0 2 8 2"
              onPress={controller.SELECT_VC_ITEM(index)}
              selectable
              selected={index === controller.selectedIndex}
              flow={VCItemContainerFlowType.VC_SHARE}
              isPinned={vcMetadata.isPinned}
            />
          ))}
        </Column>
        <Column
          style={Theme.SendVcScreenStyles.shareOptionButtonsContainer}
          backgroundColor={Theme.Colors.whiteBackgroundColor}>
          {[Issuers.Mosip, Issuers.ESignet].indexOf(
            controller.verifiableCredentialData.issuer,
          ) !== -1 && (
            <Button
              type="gradient"
              title={t('acceptRequestAndVerify')}
              styles={{marginTop: 12}}
              disabled={controller.selectedIndex == null}
              onPress={controller.VERIFY_AND_ACCEPT_REQUEST}
            />
          )}

          <Button
            type="gradient"
            styles={{marginTop: 12}}
            title={t('acceptRequest')}
            disabled={controller.selectedIndex == null}
            onPress={controller.ACCEPT_REQUEST}
          />

          <Button
            type="clear"
            loading={controller.isCancelling}
            title={t('reject')}
            onPress={controller.CANCEL}
          />
        </Column>
      </Column>

      <VerifyIdentityOverlay
        credential={controller.credential}
        verifiableCredentialData={controller.verifiableCredentialData}
        isVerifyingIdentity={controller.isVerifyingIdentity}
        onCancel={controller.CANCEL}
        onFaceValid={controller.FACE_VALID}
        onFaceInvalid={controller.FACE_INVALID}
      />

      <FaceVerificationAlertOverlay
        isVisible={controller.isFaceVerificationConsent}
        onConfirm={controller.FACE_VERIFICATION_CONSENT}
        close={controller.DISMISS}
      />

      <Error
        isModal
        alignActionsOnEnd
        showClose={false}
        isVisible={controller.isInvalidIdentity}
        title={t('ScanScreen:postFaceCapture.captureFailureTitle')}
        message={t('ScanScreen:postFaceCapture.captureFailureMessage')}
        image={SvgImage.PermissionDenied()}
        primaryButtonTestID={'retry'}
        primaryButtonText={t('ScanScreen:status.retry')}
        primaryButtonEvent={controller.RETRY_VERIFICATION}
        textButtonTestID={'home'}
        textButtonText={t('ScanScreen:status.accepted.home')}
        textButtonEvent={controller.GO_TO_HOME}
        customImageStyles={{paddingBottom: 0, marginBottom: -6}}
        customStyles={{marginTop: '20%'}}
        testID={'shareWithSelfieError'}
      />
    </React.Fragment>
  );
};
