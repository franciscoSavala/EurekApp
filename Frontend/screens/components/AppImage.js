import React from 'react';
import { Image } from 'react-native';

const DEFAULT_IMAGE = require('../../assets/defaultImage.png');

const AppImage = ({ imageUrl, b64Json, style, resizeMode = 'cover' }) => {
    const source = imageUrl
        ? { uri: imageUrl }
        : b64Json
        ? { uri: `data:image/jpeg;base64,${b64Json}` }
        : DEFAULT_IMAGE;

    return <Image source={source} style={style} resizeMode={resizeMode} />;
};

export default AppImage;
