import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import HomeScreen from "../screens/HomeScreen";
import WorkScreen from "../screens/WorkScreen";
import ManageScreen from "../screens/ManageScreen";
import RecordScreen from "../screens/RecordScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: "/work", element: <WorkScreen /> },
      { path: "/manage", element: <ManageScreen /> },
      { path: "/record", element: <RecordScreen /> }
    ]
  }
]);
