import { ArrowUpRight, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function B2CPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ArrowUpRight className="w-6 h-6 text-green-600" />
          B2C Payments
        </h2>
        <p className="text-muted-foreground mt-1">
          Send money directly from your M-Pesa shortcode to any phone number.
        </p>
      </div>

      <Card className="border-dashed border-2 border-gray-200">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-5">
          <div className="w-16 h-16 rounded-full bg-yellow-50 border-2 border-yellow-200 flex items-center justify-center">
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-sm px-3 py-1">
            Coming Soon
          </Badge>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-xl font-semibold">Feature Under Setup</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              B2C payments let you send money directly to any M-Pesa number — for refunds, salaries, commissions, and promotions.
              This feature is being configured and will be available shortly.
            </p>
          </div>
          <div className="mt-4 bg-gray-50 rounded-lg p-4 text-left w-full text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-gray-700 mb-2">What you'll be able to do:</p>
            <p>• Send money to any Kenyan phone number</p>
            <p>• Business payments, salary disbursements, promotions</p>
            <p>• Track all B2C transactions with real-time status</p>
            <p>• API access via your existing secret key</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
