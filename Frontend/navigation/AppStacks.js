import React from 'react';
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import {createStackNavigator} from "@react-navigation/stack";
import FindObject from "../screens/findObjectStack/FindObject";
import FoundObjects from "../screens/findObjectStack/FoundObjects";
import NotFoundObjects from "../screens/findObjectStack/NotFoundObjects";
import FoundObjectDetail from "../screens/inventoryStack/FoundObjectDetail";
import Inventory from "../screens/inventoryStack/Inventory";
import ReturnObjectForm from "../screens/inventoryStack/ReturnObjectForm";
import ReturnedObjects from "../screens/returnedObjectsStack/ReturnedObjects";
import ReturnedObjectDetail from "../screens/returnedObjectsStack/ReturnedObjectDetail";
import Achievements from "../screens/AchievementsStack/Achievements";
import Profile from "../screens/profileStack/Profile";
import Reports from "../screens/reportsStack/Reports";
import FraudAlerts from "../screens/fraudAlertsStack/FraudAlerts";
import FraudAlertDetail from "../screens/fraudAlertsStack/FraudAlertDetail";
import FraudReport from "../screens/fraudAlertsStack/FraudReport";
import RewardExclusionsList from "../screens/rewardExclusionsStack/RewardExclusionsList";
import MyObjectHistory from "../screens/myObjectsStack/MyObjectHistory";
import MyLostObjectDetail from "../screens/myObjectsStack/MyLostObjectDetail";
import Notifications from "../screens/notificationsStack/Notifications";
import Organization from "../screens/organizationStack/Organization";
import OrganizationPolicy from "../screens/organizationStack/OrganizationPolicy";
import OrganizationRequestsAdmin from "../screens/organizationSignUp/OrganizationRequestsAdmin";
import OrganizationRequestDetail from "../screens/organizationSignUp/OrganizationRequestDetail";

const FindObjectStack = createNativeStackNavigator();

export const FindObjectStackScreen = () => {
    return (
        <FindObjectStack.Navigator>
            <FindObjectStack.Screen options={{ headerShown: false , title: 'EurekApp - Buscar un objeto'}}
                                    name="FindObject" component={FindObject} />
            <FindObjectStack.Screen options={{ headerShown: false, title: 'EurekApp - Resultados de búsqueda' }}
                                    name="FoundObjects" component={FoundObjects} />
            <FindObjectStack.Screen options={{ headerShown: false, title: 'EurekApp - Resultados de búsqueda' }}
                                    name="NotFoundObjects" component={NotFoundObjects} />
            <FindObjectStack.Screen options={{ headerShown: false, title: 'EurekApp - Ver objeto' }}
                                    name="FoundObjectDetail" component={FoundObjectDetail} />
        </FindObjectStack.Navigator>
    );
}

const ReturnedObjectsStack = createStackNavigator();

export const ReturnedObjectsStackScreen = () => {
    return (
        <ReturnedObjectsStack.Navigator>
            <ReturnedObjectsStack.Screen
                name="ReturnedObjects"
                component = {ReturnedObjects}
                options={{headerShown:false, title: 'EurekApp - Ver objetos devueltos'}} />
            <ReturnedObjectsStack.Screen
                name="ReturnedObjectDetail"
                component = {ReturnedObjectDetail}
                options={{headerShown:false, title: 'EurekApp - Ver devolución'}} />
            <ReturnedObjectsStack.Screen
                name="FoundObjectDetail"
                component = {FoundObjectDetail}
                options={{headerShown:false, title: 'EurekApp - Ver objeto'}} />
        </ReturnedObjectsStack.Navigator>
    );
}

const InventoryStack = createStackNavigator();

export const InventoryStackScreen = () => {
    return (
        <InventoryStack.Navigator>
            <InventoryStack.Screen
                name='ReturnObjectList'
                component={Inventory}
                options={{headerShown: false, title: 'EurekApp - Ver inventario'}} />
            <InventoryStack.Screen
                name='FoundObjectDetail'
                component={FoundObjectDetail}
                options={{headerShown: false, title: 'EurekApp - Ver objeto'}} />
            <InventoryStack.Screen
                name='ReturnObjectForm'
                component={ReturnObjectForm}
                options={{headerShown: true, title: 'Devolver objeto'}} />
        </InventoryStack.Navigator>
    );
}

const AchievementsStack = createStackNavigator();

export const AchievementsStackScreen = () => {
    return (
        <AchievementsStack.Navigator>
            <AchievementsStack.Screen
                name='Achievements'
                component={Achievements}
                options={{headerShown:false, title: 'EurekApp - Logros'}} />
        </AchievementsStack.Navigator>

    );
}

const ProfileStack = createStackNavigator();

export const ProfileStackScreen = () => {
    return (
        <ProfileStack.Navigator>
            <ProfileStack.Screen
                name='Profile'
                component={Profile}
                options={{headerShown: false, title: 'EurekApp - Mi perfil'}} />
        </ProfileStack.Navigator>
    );
}

const ReportsStack = createStackNavigator();

export const ReportsStackScreen = () => {
    return (
        <ReportsStack.Navigator>
            <ReportsStack.Screen
                name='Reports'
                component={Reports}
                options={{headerShown: false, title: 'EurekApp - Reportes'}} />
        </ReportsStack.Navigator>
    );
}

const FraudAlertsStack = createStackNavigator();

export const FraudAlertsStackScreen = () => {
    return (
        <FraudAlertsStack.Navigator>
            <FraudAlertsStack.Screen
                name='FraudAlerts'
                component={FraudAlerts}
                options={{headerShown: false, title: 'EurekApp - Alertas de fraude'}} />
            <FraudAlertsStack.Screen
                name='FraudAlertDetail'
                component={FraudAlertDetail}
                options={{headerShown: true, title: 'Detalle de alerta'}} />
            <FraudAlertsStack.Screen
                name='FraudReport'
                component={FraudReport}
                options={{headerShown: true, title: 'Reporte de fraude'}} />
        </FraudAlertsStack.Navigator>
    );
}

const RewardExclusionsStack = createStackNavigator();

export const RewardExclusionsStackScreen = () => (
    <RewardExclusionsStack.Navigator>
        <RewardExclusionsStack.Screen
            name="RewardExclusionsList"
            component={RewardExclusionsList}
            options={{ headerShown: false, title: 'Exclusiones de puntos' }}
        />
    </RewardExclusionsStack.Navigator>
);

const MyObjectsStack = createStackNavigator();

export const MyObjectsStackScreen = () => {
    return (
        <MyObjectsStack.Navigator>
            <MyObjectsStack.Screen
                name="MyObjectHistory"
                component={MyObjectHistory}
                options={{ headerShown: false, title: 'EurekApp - Mis búsquedas' }}
            />
            <MyObjectsStack.Screen
                name="MyLostObjectDetail"
                component={MyLostObjectDetail}
                options={{ headerShown: false, title: 'EurekApp - Detalle de búsqueda abierta' }}
            />
        </MyObjectsStack.Navigator>
    );
}

const NotificationsStack = createStackNavigator();

export const NotificationsStackScreen = () => {
    return (
        <NotificationsStack.Navigator>
            <NotificationsStack.Screen
                name="Notifications"
                component={Notifications}
                options={{ headerShown: false, title: 'EurekApp - Notificaciones' }}
            />
            {/* EU-345: la pantalla de coincidencias se monta TAMBIÉN acá para que el aviso de
                "coincidencia encontrada" abra el objeto sin salirse del stack de notificaciones.
                Si se navegara al stack de búsqueda, "← Volver" caería en FindObject —su ruta
                inicial— y dejaría al usuario en la pantalla de buscar, no en sus notificaciones.
                Es el mismo componente, montado en los dos lugares. */}
            <NotificationsStack.Screen
                name="FoundObjects"
                component={FoundObjects}
                options={{ headerShown: false, title: 'EurekApp - Coincidencia encontrada' }}
            />
        </NotificationsStack.Navigator>
    );
}

const OrganizationStack = createStackNavigator();

export const OrganizationStackScreen = () => {
    return (
        <OrganizationStack.Navigator>
            <OrganizationStack.Screen
                name='Organization'
                component={Organization}
                options={{headerShown: false, title: 'EurekApp - Mi organización'}} />
            <OrganizationStack.Screen
                name='OrganizationPolicy'
                component={OrganizationPolicy}
                options={{headerShown: true, title: 'Políticas de la organización'}} />
        </OrganizationStack.Navigator>
    );
}

const OrgRequestsAdminStack = createStackNavigator();

export const OrgRequestsAdminStackScreen = () => (
    <OrgRequestsAdminStack.Navigator>
        <OrgRequestsAdminStack.Screen
            name="OrganizationRequestsAdmin"
            component={OrganizationRequestsAdmin}
            options={{ headerShown: false, title: 'EurekApp - Solicitudes de alta' }}
        />
        <OrgRequestsAdminStack.Screen
            name="OrganizationRequestDetail"
            component={OrganizationRequestDetail}
            options={{ headerShown: true, title: 'Detalle de solicitud' }}
        />
    </OrgRequestsAdminStack.Navigator>
);
