import * as React from 'react'

import './App.css'
import SideBar from 'components/SideBar'
import HomePage from 'components/HomePage'
import Libraries from 'components/Libraries'


const App = () => {
    const [router, setRouter] = React.useState('/')
    const renderPage = () => {
        switch (router) {
            case '/':
                return (
                    <HomePage setRouter={setRouter} />
                )
            case '/examples':
                return (
                    <Libraries type="example" />
                )
            case '/libraries':
                return (
                    <Libraries type="package" />
                )
            default:
                return (
                    <HomePage setRouter={setRouter} />
                )
        }
    }
    return (
        <div className="App">
            <SideBar setRouter={setRouter} router={router} />
            <div className="container">
                {
                    renderPage()
                }
            </div>
        </div>
    )
}

export default App