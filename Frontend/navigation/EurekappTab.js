import React, {useContext, useState} from 'react';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {createDrawerNavigator} from "@react-navigation/drawer";
import Icon from "react-native-vector-icons/FontAwesome6";
import {LoginContext} from "../hooks/useUser";
import {useMenuCounters} from "../hooks/useMenuCounters";
import {BadgeIcon} from "../components/BadgeIcon";
import {CustomDrawerContent} from "../components/CustomDrawerContent";
import UploadObject from "../screens/uploadFoundObjectStack/UploadObject";
import OrganizationSignupForm from "../screens/organizationSignUp/OrganizationSignupForm";
import MyOrganizationRequest from "../screens/organizationSignUp/MyOrganizationRequest";
import UsabilityFeedbackReport from "../screens/adminStack/UsabilityFeedbackReport";
import OrganizationFeedbackSurvey from "../screens/myObjectsStack/OrganizationFeedbackSurvey";
import UserManagement from "../screens/adminStack/UserManagement";
import OrganizationManagement from "../screens/adminStack/OrganizationManagement";
import GlobalStatisticsDashboard from "../screens/adminStack/GlobalStatisticsDashboard";
import FraudDetectionConfig from "../screens/adminStack/FraudDetectionConfig";
import {
    FindObjectStackScreen, ReturnedObjectsStackScreen, InventoryStackScreen, AchievementsStackScreen,
    ProfileStackScreen, ReportsStackScreen, FraudAlertsStackScreen, RewardExclusionsStackScreen,
    MyObjectsStackScreen, NotificationsStackScreen, OrganizationStackScreen, OrgRequestsAdminStackScreen,
} from "./AppStacks";

const Drawer = createDrawerNavigator();

export const EurekappTab = () => {
    const searchIcon = () => <Icon name={'magnifying-glass'} size={20} />
    const uploadIcon = () => <Icon name={'upload'} size={20} />
    const historyIcon = () => <Icon name={'clock-rotate-left'} size={20} />
    const boxesIcon = () => <Icon name={'boxes-stacked'} size={20} />
    const trophyIcon = () => <Icon name={'trophy'} size={20} />
    const userIcon = () => <Icon name={'user'} size={20}/>
    const organizationIcon = () => <Icon name={'sitemap'} size={20}/>
    const chartIcon = () => <Icon name={'chart-bar'} size={20}/>
    const slidersIcon = () => <Icon name={'sliders'} size={20}/>
    const commentIcon = () => <Icon name={'comment-dots'} size={20}/>
    const navigation = useNavigation();
    const [ isOrgAdmin, setIsOrgAdmin ] = useState(false);
    const { userRole } = useContext(LoginContext);
    const {
        unreadNotifCount, setUnreadNotifCount,
        pendingOrgRequestCount, fetchPendingCount,
        unseenFraudAlertCount, markFraudAlertsSeen,
    } = useMenuCounters(userRole);

    const orgRequestsIcon = () => <BadgeIcon name={'sitemap'} count={pendingOrgRequestCount} />;

    const bellIcon = () => <BadgeIcon name={'bell'} count={unreadNotifCount} />;

    const fraudAlertsIcon = () => <BadgeIcon name={'shield-halved'} count={unseenFraudAlertCount} />;

    const resetAndNavigate = (navigation, screenName) => {
        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: screenName }],
            })
        );
    };

    return (
        <Drawer.Navigator
            key={userRole}
            initialRouteName={
                (userRole === 'ORGANIZATION_OWNER' || userRole === 'ORGANIZATION_EMPLOYEE' || userRole === 'ENCARGADO')
                    ? 'LostObjectReturnStackScreen'
                    : userRole === 'ADMIN'
                        ? 'GlobalStatisticsDashboard'
                        : 'FindObjectStackScreen'
            }
            drawerContent={(props) => <CustomDrawerContent {...props} />} >
            {userRole !== 'ORGANIZATION_OWNER' && userRole !== 'ORGANIZATION_EMPLOYEE' && userRole !== 'ENCARGADO' ? (
                <Drawer.Screen name="FindObjectStackScreen" options={{
                    title: 'Buscar un objeto',
                    headerTitleAlign: 'center',
                    drawerIcon: searchIcon
                }} listeners={{
                    drawerItemPress: () => resetAndNavigate(navigation, "FindObject")
                }} component={FindObjectStackScreen}
                />
            ) : null}
            {userRole === 'ORGANIZATION_OWNER' || userRole === 'ORGANIZATION_EMPLOYEE' || userRole === 'ENCARGADO' ?
                <>
                    <Drawer.Screen name="UploadObject" options={{
                        title: 'Receptar un objeto',
                        headerTitleAlign: 'center',
                        drawerIcon: uploadIcon
                    }} component={UploadObject}
                    />
                    <Drawer.Screen name="LostObjectReturnStackScreen" options={{
                        title: 'Ver inventario',
                        headerTitleAlign: 'center',
                        drawerIcon: boxesIcon
                    }} listeners={{
                        drawerItemPress: () => resetAndNavigate(navigation,"LostObjectReturnStackScreen")
                    }} component={InventoryStackScreen}
                    />
                    <Drawer.Screen name="ReturnedObjectsStackScreen" options={{
                        title: 'Ver objetos devueltos',
                        headerTitleAlign: 'center',
                        drawerIcon: historyIcon
                    }} listeners={{
                        drawerItemPress: () => resetAndNavigate(navigation,"ReturnedObjectsStackScreen")
                    }} component={ReturnedObjectsStackScreen}
                    />
                </>
                : null
            }

            {userRole === 'REGULAR_USER' || userRole === 'USER' ?
            <>
                <Drawer.Screen name="MyObjectsStackScreen" options={{
                    title: 'Mis búsquedas',
                    headerTitleAlign: 'center',
                    drawerIcon: historyIcon
                }} listeners={{
                    drawerItemPress: () => resetAndNavigate(navigation, 'MyObjectsStackScreen')
                }} component={MyObjectsStackScreen} />
                <Drawer.Screen name="OrganizationSignupForm" options={{
                    title: 'Solicitar alta de organización',
                    headerTitleAlign: 'center',
                    drawerIcon: uploadIcon
                }} component={OrganizationSignupForm} />
                <Drawer.Screen name="MyOrganizationRequest" options={{
                    title: 'Mi solicitud de organización',
                    headerTitleAlign: 'center',
                    drawerIcon: organizationIcon
                }} component={MyOrganizationRequest} />
            </>: null
            }

            {userRole === 'ADMIN' ?
            <>
                <Drawer.Screen name="GlobalStatisticsDashboard" options={{
                    title: 'Dashboard',
                    headerTitleAlign: 'center',
                    drawerIcon: chartIcon
                }} component={GlobalStatisticsDashboard} />
                <Drawer.Screen name="OrgRequestsAdminStackScreen" options={{
                    title: 'Solicitudes de alta',
                    headerTitleAlign: 'center',
                    drawerIcon: orgRequestsIcon
                }} listeners={{
                    focus: () => fetchPendingCount()
                }} component={OrgRequestsAdminStackScreen} />
                <Drawer.Screen name="UserManagement" options={{
                    title: 'Usuarios',
                    headerTitleAlign: 'center',
                    drawerIcon: userIcon
                }} component={UserManagement} />
                <Drawer.Screen name="OrganizationManagement" options={{
                    title: 'Organizaciones',
                    headerTitleAlign: 'center',
                    drawerIcon: organizationIcon
                }} component={OrganizationManagement} />
                <Drawer.Screen name="FraudAlertsStackScreen" options={{
                    title: 'Alertas de fraude',
                    headerTitleAlign: 'center',
                    drawerIcon: fraudAlertsIcon
                }} listeners={{
                    focus: () => markFraudAlertsSeen()
                }} component={FraudAlertsStackScreen} />
                <Drawer.Screen name="FraudDetectionConfigStackScreen" options={{
                    title: 'Configuración de fraude',
                    headerTitleAlign: 'center',
                    drawerIcon: slidersIcon
                }} component={FraudDetectionConfig} />
                {/* EU-370: la opinión sobre la aplicación la lee quien puede corregir la
                    aplicación. Antes colgaba del menú de reportes del responsable de organización,
                    que no puede accionarla. */}
                <Drawer.Screen name="UsabilityFeedbackReport" options={{
                    title: 'Opiniones sobre la app',
                    headerTitleAlign: 'center',
                    drawerIcon: commentIcon
                }} component={UsabilityFeedbackReport} />
            </> : null
            }

            {(userRole === 'USER' || userRole === 'REGULAR_USER') ?
                <Drawer.Screen name="AchievementsStackScreen" options={{
                    title: 'Logros',
                    headerTitleAlign: 'center',
                    drawerIcon: trophyIcon
                }} listeners={{
                    drawerItemPress: () => resetAndNavigate(navigation,"AchievementsStackScreen")
                }} component={AchievementsStackScreen}
                />
            : null}

            <Drawer.Screen name="NotificationsStackScreen" options={{
                title: 'Notificaciones',
                headerTitleAlign: 'center',
                drawerIcon: bellIcon
            }} listeners={{
                drawerItemPress: () => {
                    setUnreadNotifCount(0);
                    resetAndNavigate(navigation, 'NotificationsStackScreen');
                }
            }} component={NotificationsStackScreen}
            />

            <Drawer.Screen name="ProfileStackScreen" options={{
                title: 'Mi perfil',
                headerTitleAlign: 'center',
                drawerIcon: userIcon
            }} component={ProfileStackScreen}
            />

            {/* EU-374: a la encuesta de atención se llega ÚNICAMENTE por el enlace del correo. La
                ruta tiene que existir para que el enlace resuelva, pero no se lista en el menú:
                fuera de ese correo no hay ningún camino que lleve acá. Quién puede responderla lo
                decide el backend, que verifica que la devolución sea de quien la está abriendo. */}
            <Drawer.Screen name="OrganizationFeedbackSurvey" options={{
                title: 'Calificar la atención',
                headerTitleAlign: 'center',
                drawerItemStyle: { display: 'none' }
            }} component={OrganizationFeedbackSurvey}
            />

            {userRole === 'ORGANIZATION_OWNER' ?
                <>
                    <Drawer.Screen name="ReportsStackScreen" options={{
                        title: 'Reportes',
                        headerTitleAlign: 'center',
                        drawerIcon: chartIcon
                    }} component={ReportsStackScreen}
                    />
                    <Drawer.Screen name="RewardExclusionsStackScreen" options={{
                        title: 'Exclusiones de recompensa',
                        headerTitleAlign: 'center',
                        drawerIcon: () => <Icon name={'ban'} size={20} />,
                    }} component={RewardExclusionsStackScreen}
                    />
                    <Drawer.Screen name="OrganizationStackScreen" options={{
                        title: 'Mi organización',
                        headerTitleAlign: 'center',
                        drawerIcon: organizationIcon
                    }} component={OrganizationStackScreen}
                    listeners={({ navigation }) => ({
                        drawerItemPress: e => {
                            e.preventDefault();
                            navigation.navigate('OrganizationStackScreen', { screen: 'Organization' });
                        },
                    })}
                    />
                    <Drawer.Screen name="MyOrganizationRequestOwner" options={{
                        title: 'Mi solicitud de organización',
                        headerTitleAlign: 'center',
                        drawerIcon: historyIcon
                    }} component={MyOrganizationRequest}
                    />
                </>: null}
        </Drawer.Navigator>
    );
}
