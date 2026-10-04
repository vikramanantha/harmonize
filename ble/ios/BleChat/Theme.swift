import SwiftUI

/// Harmonize brand: violet into pink, like two tastes blending. Matches android/.../ui/Theme.kt.
enum Brand {
    static let violet = Color(red: 0x6D / 255, green: 0x4A / 255, blue: 0xFF / 255)
    static let pink = Color(red: 0xFF / 255, green: 0x5C / 255, blue: 0xA8 / 255)
    static let gradient = LinearGradient(colors: [violet, pink], startPoint: .topLeading, endPoint: .bottomTrailing)
}

/// The mark: two overlapping circles.
struct Logo: View {
    var size: CGFloat
    var onGradient = false

    var body: some View {
        let r = size * 0.30
        ZStack {
            Circle()
                .fill(onGradient ? Color.white.opacity(0.95) : Brand.violet)
                .frame(width: r * 2, height: r * 2)
                .offset(x: -r * 0.55)
            Circle()
                .fill(onGradient ? Color.white.opacity(0.6) : Brand.pink.opacity(0.8))
                .frame(width: r * 2, height: r * 2)
                .offset(x: r * 0.55)
        }
        .frame(width: size, height: size)
    }
}

/// Full-width gradient button with a spinner while `busy`.
struct GradientButton: View {
    var title: String
    var busy: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if busy {
                    ProgressView().tint(.white)
                } else {
                    Text(title).font(.headline).foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(Brand.gradient, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }
}

/// A friendly message card; red for problems, violet for information.
struct MessageCard: View {
    var text: String
    var isError: Bool
    var mono = false

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: isError ? "exclamationmark.triangle.fill" : "info.circle.fill")
            Text(text)
                .font(mono ? .caption.monospaced() : .subheadline)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .foregroundStyle(isError ? Color.red : Brand.violet)
        .background((isError ? Color.red : Brand.violet).opacity(0.10), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

/// White rounded card on the grouped background.
struct CardBox<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
    }
}

/// Round avatar with the first letter of a name, on the brand gradient.
struct Avatar: View {
    var name: String
    var size: CGFloat

    var body: some View {
        Text(String(name.drop(while: { $0 == "@" }).prefix(1)).uppercased())
            .font(.system(size: size * 0.42, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Brand.gradient, in: Circle())
    }
}

/// Compatibility score as a ring with the percentage inside.
struct ScoreRing: View {
    var score: Double
    var highlight: Bool

    var body: some View {
        ZStack {
            Circle().stroke(Color(.systemFill), lineWidth: 5)
            Circle()
                .trim(from: 0, to: min(max(score, 0), 1))
                .stroke(highlight ? Brand.pink : Brand.violet, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int(score * 100))%").font(.subheadline.weight(.semibold))
        }
        .frame(width: 56, height: 56)
    }
}

/// Three signal bars from a Bluetooth RSSI.
struct SignalBars: View {
    var rssi: Int

    var body: some View {
        let level = rssi >= -60 ? 3 : rssi >= -75 ? 2 : 1
        HStack(alignment: .bottom, spacing: 3) {
            ForEach(1...3, id: \.self) { bar in
                RoundedRectangle(cornerRadius: 2)
                    .fill(bar <= level ? Brand.violet : Color(.systemFill))
                    .frame(width: 5, height: CGFloat(6 + bar * 5))
            }
        }
    }
}

struct Pill: View {
    var text: String
    var tint: Color

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(tint)
            .background(tint.opacity(0.14), in: Capsule())
    }
}

/// A softly pulsing dot for "live" status.
struct LiveDot: View {
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle().fill(.white.opacity(0.3)).frame(width: 14, height: 14).scaleEffect(pulse ? 1.4 : 0.6)
            Circle().fill(.white).frame(width: 8, height: 8)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { pulse = true }
        }
    }
}
