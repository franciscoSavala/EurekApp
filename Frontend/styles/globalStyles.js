export const colors = {
    primary: '#19e6e6',
    background: '#fff',
    surface: '#f0f4f4',
    text: '#111818',
    textMuted: '#638888',
    border: '#bdc1c1',
    warning: '#b45309',
    warningBg: '#fef3c7',
    success: '#065f46',
    successBg: '#d1fae5',
    danger: '#991b1b',
    dangerBg: '#fee2e2',
    info: '#1d4ed8',
    infoBg: '#dbeafe',
};

export const typography = {
    label: {
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular',
        color: colors.text,
    },
    title: {
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Bold',
        color: colors.text,
    },
    muted: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        color: colors.textMuted,
    },
};

export const layout = {
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    formContainer: {
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 10,
        maxWidth: '1000px',
        width: '100%',
        alignSelf: 'center',
    },
    row: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 10,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
};
