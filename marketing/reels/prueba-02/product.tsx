import {createRoot} from 'react-dom/client'
import {BookingPage} from '../../../app/src/screens/BookingPage.tsx'
import '../../../app/src/styles.css'
import '../../../app/src/natural.css'
import './capture.css'
createRoot(document.getElementById('root')!).render(<div className="natural-theme"><BookingPage slug="salon-de-ejemplo" /></div>)
