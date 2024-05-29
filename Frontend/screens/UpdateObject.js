import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import {Button, Text, View, StyleSheet} from "react-native";

const imgDir = FileSystem.documentDirectory + 'images';


const ensureDirExists = async () => {
    const dirInfo = await FileSystem.getInfoAsync(imgDir);
    if(!dirInfo.exists){
        await FileSystem.makeDirectoryAsync(imgDir, { intermediates: true });
    }
}

const UpdateObject = ({navigation}) => {
    const selectImage = async () => {
        let res = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images
        });
        if(!res.canceled){
            console.log(res.assets[0].fileName);
        }
    }

    return (
        <View style={styles.container}>
            <Text>Postear objeto: </Text>
            <Button title="Seleccionar Imagen" onPress={selectImage} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default UpdateObject;