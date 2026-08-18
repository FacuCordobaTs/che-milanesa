import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { QrCode, UtensilsCrossed, CreditCard, ArrowRight, ChefHat } from 'lucide-react'

const Welcome = () => {
  const [fadeIn, setFadeIn] = useState(false)

  useEffect(() => {
    setFadeIn(true)
  }, [])

  const handleGoToAdmin = () => {
    window.location.href = 'https://admin.piru.app'
  }

  const features = [
    {
      icon: QrCode,
      title: 'Escanear QR',
      description: 'Los clientes escanean el código QR de su mesa'
    },
    {
      icon: UtensilsCrossed,
      title: 'Pedir fácil',
      description: 'Realizan pedidos directamente desde su celular'
    },
    {
      icon: CreditCard,
      title: 'Pagar rápido',
      description: 'Pagan con MercadoPago o efectivo sin esperas'
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6 py-24">
        <div className={`max-w-4xl mx-auto text-center relative z-10 transition-all duration-1000 ${
          fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {/* Logo/Título */}
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-foreground mb-6 text-balance">
              PIRU
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-balance">
              El sistema operativo del restaurante
            </p>
            <p className="text-lg md:text-xl text-muted-foreground/80 max-w-xl mx-auto mt-4">
              Automatiza pedidos y pagos usando códigos QR. Más ventas, menos esperas.
            </p>
          </div>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <Button 
              size="lg"
              onClick={handleGoToAdmin}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 rounded-lg text-lg font-medium transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
              <ChefHat className="w-5 h-5 mr-2" />
              Ir al Panel de Administración
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div 
                  key={feature.title}
                  className={`flex flex-col items-center gap-4 p-6 rounded-2xl bg-card border border-border transition-all duration-700 ${
                    fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{ transitionDelay: `${(index + 1) * 200}ms` }}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-1000 ${
          fadeIn ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="w-6 h-10 rounded-full border-2 border-foreground/30 flex items-start justify-center p-2 animate-bounce">
            <div className="w-1 h-2 rounded-full bg-foreground/50"></div>
          </div>
        </div>
      </section>

      {/* Footer Simple */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Piru. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Welcome

