import { useRef } from 'react'
import { Modal, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from './Button'
import { colors, type } from '@/lib/theme'

/** The camera, full screen, until it reads a QR code. */
export function DoorScanner({ open, onRead, onCancel }: { open: boolean; onRead: (text: string) => void; onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions()
  // The camera reports a code many times a second; only the first counts.
  const read = useRef(false)

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onCancel} onShow={() => (read.current = false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (read.current) return
              read.current = true
              onRead(data)
            }}
          />
        ) : (
          <View className="flex-1 justify-center gap-4 px-6">
            <Text style={{ ...type.title, color: colors.paper }}>Scan the door code</Text>
            <Text style={{ ...type.body, color: colors.sky }}>Veni needs the camera to read the code on the door screen.</Text>
            {permission?.canAskAgain === false ? null : <Button label="Allow the camera" onPress={requestPermission} />}
          </View>
        )}
        <View className="gap-3 p-5">
          {permission?.granted ? (
            <Text style={{ ...type.body, color: colors.paper, textAlign: 'center' }}>Point at the code on the door screen.</Text>
          ) : null}
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
      </SafeAreaView>
    </Modal>
  )
}
